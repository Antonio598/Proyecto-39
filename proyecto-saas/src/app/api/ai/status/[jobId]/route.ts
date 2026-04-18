import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { pollJobStatus } from "@/lib/ai/orchestrator";
import { handleApiError } from "@/lib/utils/errors";
import { mergeAudioVideo, concatVideoClips } from "@/lib/ai/merge";
import { KlingClient } from "@/lib/ai/kling";

export const maxDuration = 300;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const { jobId } = await params;
    const admin = createAdminClient();

    // Get the generated post record to find provider
    const { data: post } = await admin
      .from("generated_posts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("ai_job_id", jobId)
      .single();

    if (!post) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // If already completed (has actual media), return cached result immediately
    if (post.media_urls?.length > 0) {
      return NextResponse.json({
        data: {
          status: "completed",
          progress: 100,
          result: {
            caption: post.caption,
            hashtags: post.hashtags,
            mediaUrls: post.media_urls,
            postId: post.id,
          },
        },
      });
    }

    // Get AI keys from brand_settings
    const { data: brand } = await admin
      .from("brand_settings")
      .select("nano_banana_key, kling_key")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    // ── Multi-clip path: poll all 3 Kling jobs, concat when all done ────────
    type MultiClipJob = { jobId: string; scene: number; imageUrl: string };
    const multiClipJobs = post.platform_data?.multi_clip_jobs as MultiClipJob[] | undefined;

    if (multiClipJobs?.length) {
      if (!brand?.kling_key) {
        return NextResponse.json({ data: { status: "failed", progress: null, result: null, error: "No hay API key de Kling configurada" } });
      }

      const kling = new KlingClient(brand.kling_key);

      // If raw clip URLs were already saved in a previous poll (Kling finished), skip re-polling
      const savedClipUrls = post.platform_data?.raw_clip_urls as string[] | undefined;
      let videoUrls: string[];

      if (savedClipUrls?.length) {
        videoUrls = savedClipUrls;
      } else {
        // Poll all 3 Kling jobs
        const clipStatuses = await Promise.all(multiClipJobs.map((j) => kling.getJobStatus(j.jobId)));

        const failed = clipStatuses.find((s) => s.status === "failed");
        if (failed) {
          return NextResponse.json({
            data: { status: "failed", progress: null, result: null, error: failed.error ?? "Un clip falló en Kling" },
          });
        }

        const allDone = clipStatuses.every((s) => s.status === "completed");
        if (!allDone) {
          const doneCount = clipStatuses.filter((s) => s.status === "completed").length;
          return NextResponse.json({
            data: { status: "processing", progress: Math.round((doneCount / clipStatuses.length) * 80), result: null, error: null },
          });
        }

        videoUrls = multiClipJobs.map((j, i) => {
          const url = clipStatuses[i].videoUrl;
          if (!url) throw new Error(`Sin videoUrl para escena ${j.scene}`);
          return url;
        });

        // Save clip URLs and set first clip as immediate fallback in media_urls.
        // This prevents infinite concat retries if the function times out below.
        await admin.from("generated_posts").update({
          media_urls: [videoUrls[0]],
          platform_data: { ...post.platform_data, raw_clip_urls: videoUrls },
        }).eq("id", post.id);
      }

      // Try FFmpeg concat (capped at 45s). On failure, first clip already saved as fallback.
      let finalVideoUrl = videoUrls[0];
      try {
        const concatBuffer = await Promise.race([
          concatVideoClips({ videoUrls }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Concat timeout")), 45000)
          ),
        ]);

        const concatPath = `${workspaceId}/videos/${post.id}-concat.mp4`;
        await admin.storage
          .from("workspace-media")
          .upload(concatPath, concatBuffer, { contentType: "video/mp4", upsert: true });
        const { data: { publicUrl: concatUrl } } = admin.storage
          .from("workspace-media")
          .getPublicUrl(concatPath);

        finalVideoUrl = concatUrl;

        // Optional voice merge on the concatenated video
        const voiceUrl = post.platform_data?.voice_url as string | undefined;
        if (voiceUrl) {
          try {
            const audioRes = await fetch(voiceUrl);
            if (audioRes.ok) {
              const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
              const voicedBuffer = await mergeAudioVideo({ videoUrl: concatUrl, audioBuffer });
              const voicedPath = `${workspaceId}/videos/${post.id}-voiced.mp4`;
              const { error: vErr } = await admin.storage
                .from("workspace-media")
                .upload(voicedPath, voicedBuffer, { contentType: "video/mp4", upsert: true });
              if (!vErr) {
                const { data: { publicUrl: vUrl } } = admin.storage
                  .from("workspace-media")
                  .getPublicUrl(voicedPath);
                finalVideoUrl = vUrl;
              }
            }
          } catch {
            // voice merge failed — concat video is the final fallback
          }
        }
      } catch (concatErr) {
        // Concat timed out or failed — first clip already saved, just log and continue
        console.warn("[Status] Concat failed, using first clip as fallback:", concatErr instanceof Error ? concatErr.message : concatErr);
      }

      // Always persist the final URL (overwrites the first-clip fallback if concat succeeded)
      await admin.from("generated_posts").update({ media_urls: [finalVideoUrl] }).eq("id", post.id);

      return NextResponse.json({
        data: {
          status: "completed",
          progress: 100,
          result: {
            postId: post.id,
            mediaUrls: [finalVideoUrl],
            caption: post.caption ?? null,
            hashtags: post.hashtags ?? [],
          },
          error: null,
        },
      });
    }

    // ── Single-clip path (unchanged) ─────────────────────────────────────────
    const jobStatus = await pollJobStatus(
      {
        provider: post.ai_provider as "nano_banana" | "kling",
        jobId,
        type: post.platform_data?.jobType ?? "image",
      },
      brand?.nano_banana_key ?? undefined,
      brand?.kling_key ?? undefined,
      post.platform_data
    );

    // If completed, update the DB record
    if (jobStatus.status === "completed") {
      const updates: Record<string, unknown> = {};
      if ("imageUrl" in jobStatus && jobStatus.imageUrl) {
        updates.media_urls = [jobStatus.imageUrl];
      }

      // For video: if a voice-over was pre-generated, merge audio + video with FFmpeg
      if ("videoUrl" in jobStatus && jobStatus.videoUrl) {
        const voiceUrl = post.platform_data?.voice_url as string | undefined;

        if (voiceUrl) {
          try {
            // Download the stored MP3
            const audioRes = await fetch(voiceUrl);
            if (!audioRes.ok) throw new Error(`Failed to fetch voice audio: ${audioRes.status}`);
            const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

            // FFmpeg merge
            const mergedBuffer = await mergeAudioVideo({
              videoUrl: jobStatus.videoUrl,
              audioBuffer,
            });

            // Upload merged MP4 to Supabase Storage
            const mergedPath = `${workspaceId}/videos/${post.id}-voiced.mp4`;
            const { error: uploadError } = await admin.storage
              .from("workspace-media")
              .upload(mergedPath, mergedBuffer, { contentType: "video/mp4", upsert: true });

            if (!uploadError) {
              const { data: { publicUrl } } = admin.storage
                .from("workspace-media")
                .getPublicUrl(mergedPath);
              updates.media_urls = [publicUrl];
              jobStatus.videoUrl = publicUrl;
            } else {
              // Merge failed — fall back to raw Kling video
              updates.media_urls = [jobStatus.videoUrl];
            }
          } catch {
            // Merge failed — fall back to raw Kling video
            updates.media_urls = [jobStatus.videoUrl];
          }
        } else {
          updates.media_urls = [jobStatus.videoUrl];
        }
      }

      if ("caption" in jobStatus && jobStatus.caption) {
        updates.caption = jobStatus.caption;
      }
      if ("hashtags" in jobStatus && jobStatus.hashtags) {
        updates.hashtags = jobStatus.hashtags;
      }

      if (Object.keys(updates).length > 0) {
        await admin
          .from("generated_posts")
          .update(updates)
          .eq("id", post.id);
      }
    }

    return NextResponse.json({
      data: {
        status: jobStatus.status,
        progress: ("progress" in jobStatus ? jobStatus.progress : undefined) ?? null,
        result:
          jobStatus.status === "completed"
            ? {
                postId: post.id,
                mediaUrls: (jobStatus as { videoUrl?: string; imageUrl?: string }).videoUrl
                  ? [(jobStatus as { videoUrl: string }).videoUrl]
                  : (jobStatus as { imageUrl?: string }).imageUrl
                  ? [(jobStatus as { imageUrl: string }).imageUrl]
                  : [],
                caption: (jobStatus as { caption?: string }).caption ?? null,
                hashtags: (jobStatus as { hashtags?: string[] }).hashtags ?? [],
              }
            : null,
        error: jobStatus.error ?? null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
