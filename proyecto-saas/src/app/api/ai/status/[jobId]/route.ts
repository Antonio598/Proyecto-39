import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { pollJobStatus } from "@/lib/ai/orchestrator";
import { handleApiError } from "@/lib/utils/errors";
import { mergeAudioVideo, concatVideoClips } from "@/lib/ai/merge";
import { KlingClient } from "@/lib/ai/kling";

export const maxDuration = 120;

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

    // ── Multi-clip sequential state machine ───────────────────────────────
    type ClipJob = { scene: number; jobId: string | null; url: string | null };
    const isMultiClip = post.platform_data?.multi_clip === true;

    if (isMultiClip) {
      const kling = new KlingClient(brand?.kling_key ?? "");
      const clipJobs = (post.platform_data?.clip_jobs ?? []) as ClipJob[];
      const imageUrls = (post.platform_data?.image_urls ?? []) as string[];
      const prompt = (post.platform_data?.prompt ?? "") as string;
      const aspectRatio = (post.platform_data?.aspect_ratio ?? "9:16") as "9:16" | "16:9" | "1:1";

      // Find the active clip: has jobId but no url yet
      const activeClip = clipJobs.find((j) => j.jobId && !j.url);
      const completedCount = clipJobs.filter((j) => j.url).length;

      if (!activeClip) {
        // No active clip — shouldn't happen unless already done
        return NextResponse.json({ data: { status: "processing", progress: completedCount * 33 } });
      }

      const clipStatus = await kling.getJobStatus(activeClip.jobId!);

      if (clipStatus.status === "failed") {
        return NextResponse.json({ data: { status: "failed", progress: null, result: null, error: clipStatus.error ?? "Clip falló" } });
      }

      if (clipStatus.status !== "completed" || !clipStatus.videoUrl) {
        // Still generating this clip
        const progress = completedCount * 33 + 10;
        return NextResponse.json({ data: { status: "processing", progress, result: null, error: null } });
      }

      // Clip completed — save its URL
      activeClip.url = clipStatus.videoUrl;
      const nextClip = clipJobs.find((j) => !j.jobId);

      if (nextClip) {
        // Start next clip
        const nextImageUrl = imageUrls[nextClip.scene - 1];
        const newJob = await kling.generateVideo({
          prompt,
          aspectRatio,
          duration: 10,
          sound: false,
          referenceImageUrl: nextImageUrl,
        });
        nextClip.jobId = newJob.jobId;

        await admin.from("generated_posts").update({
          platform_data: { ...post.platform_data, clip_jobs: clipJobs },
        }).eq("id", post.id);

        const progress = (completedCount + 1) * 33;
        return NextResponse.json({ data: { status: "processing", progress, result: null, error: null } });
      }

      // All clips done — concatenate
      const allUrls = clipJobs.map((j) => j.url!);
      const concatBuffer = await concatVideoClips({ videoUrls: allUrls });

      // Voice merge if applicable
      const voiceUrl = post.platform_data?.voice_url as string | undefined;
      let finalBuffer = concatBuffer;

      if (voiceUrl) {
        try {
          const audioRes = await fetch(voiceUrl);
          if (audioRes.ok) {
            const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
            finalBuffer = await mergeAudioVideo({ videoUrl: "", audioBuffer, videoBuffer: concatBuffer });
          }
        } catch { /* fallback to concat without voice */ }
      }

      const finalPath = `${workspaceId}/videos/${post.id}-final.mp4`;
      const { error: uploadError } = await admin.storage
        .from("workspace-media")
        .upload(finalPath, finalBuffer, { contentType: "video/mp4", upsert: true });

      if (uploadError) {
        return NextResponse.json({ data: { status: "failed", progress: null, result: null, error: "Error subiendo video final" } });
      }

      const { data: { publicUrl } } = admin.storage.from("workspace-media").getPublicUrl(finalPath);

      await admin.from("generated_posts").update({
        media_urls: [publicUrl],
        platform_data: { ...post.platform_data, clip_jobs: clipJobs },
      }).eq("id", post.id);

      return NextResponse.json({
        data: {
          status: "completed",
          progress: 100,
          result: {
            postId: post.id,
            mediaUrls: [publicUrl],
            caption: post.caption ?? null,
            hashtags: post.hashtags ?? [],
          },
          error: null,
        },
      });
    }

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
