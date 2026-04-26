import { KlingClient } from "./kling";
import { concatVideoClips, mergeAudioVideo } from "./merge";
import { pollJobStatus } from "./orchestrator";
import type { SupabaseClient } from "@supabase/supabase-js";

type ClipJob = { scene: number; jobId: string | null; url: string | null };

export type VideoProcessResult =
  | { status: "processing"; progress: number }
  | { status: "completed"; mediaUrls: string[]; caption: string | null; hashtags: string[] }
  | { status: "failed"; error: string };

export interface GeneratedPostRow {
  id: string;
  workspace_id: string;
  ai_provider: string;
  ai_job_id: string | null;
  media_urls: string[];
  caption: string | null;
  hashtags: string[];
  platform_data: Record<string, unknown> | null;
}

/**
 * Advance a Kling (single or multi-clip) AI job one step.
 * Checks Kling status, starts the next clip if needed, runs FFmpeg concat
 * when all clips are done, and updates generated_posts in the DB.
 *
 * Called by both the status polling route (client online) and the
 * process-videos cron (runs every minute regardless of client state).
 */
export async function processKlingJob(
  post: GeneratedPostRow,
  klingKey: string,
  workspaceId: string,
  admin: SupabaseClient,
  nanoBananaKey?: string,
): Promise<VideoProcessResult> {
  const isMultiClip = post.platform_data?.multi_clip === true;
  if (isMultiClip) {
    return runMultiClipStep(post, klingKey, workspaceId, admin);
  }
  return runSingleClipStep(post, klingKey, workspaceId, admin, nanoBananaKey);
}

// ── Multi-clip state machine ─────────────────────────────────────────────────

async function runMultiClipStep(
  post: GeneratedPostRow,
  klingKey: string,
  workspaceId: string,
  admin: SupabaseClient,
): Promise<VideoProcessResult> {
  const kling = new KlingClient(klingKey);
  const clipJobs = (post.platform_data?.clip_jobs ?? []) as ClipJob[];
  const imageUrls = (post.platform_data?.image_urls ?? []) as string[];
  const prompt = (post.platform_data?.prompt ?? "") as string;
  const aspectRatio = (post.platform_data?.aspect_ratio ?? "9:16") as "9:16" | "16:9" | "1:1";

  const activeClip = clipJobs.find((j) => j.jobId && !j.url);
  const completedCount = clipJobs.filter((j) => j.url).length;

  if (!activeClip) {
    return { status: "processing", progress: completedCount * 33 };
  }

  const clipStatus = await kling.getJobStatus(activeClip.jobId!);

  if (clipStatus.status === "failed") {
    return { status: "failed", error: clipStatus.error ?? "Clip falló" };
  }

  if (clipStatus.status !== "completed" || !clipStatus.videoUrl) {
    return { status: "processing", progress: completedCount * 33 + 10 };
  }

  // This clip finished — save URL and maybe start the next one
  activeClip.url = clipStatus.videoUrl;
  const nextClip = clipJobs.find((j) => !j.jobId);

  if (nextClip) {
    const newJob = await kling.generateVideo({
      prompt,
      aspectRatio,
      duration: 10,
      sound: false,
      referenceImageUrl: imageUrls[nextClip.scene - 1],
    });
    nextClip.jobId = newJob.jobId;
    console.log(`[VideoProcessor] clip ${activeClip.scene} done → starting clip ${nextClip.scene} (${newJob.jobId})`);

    await admin.from("generated_posts").update({
      platform_data: { ...post.platform_data, clip_jobs: clipJobs },
    }).eq("id", post.id);

    return { status: "processing", progress: (completedCount + 1) * 33 };
  }

  // All clips done → FFmpeg concat
  console.log(`[VideoProcessor] all ${clipJobs.length} clips done, concatenating…`);
  const allUrls = clipJobs.map((j) => j.url!);

  let finalBuffer: Buffer;
  try {
    finalBuffer = await concatVideoClips({ videoUrls: allUrls });
  } catch (err) {
    console.error("[VideoProcessor] concat failed:", err);
    return { status: "failed", error: `FFmpeg concat: ${err instanceof Error ? err.message : String(err)}` };
  }

  // Optional voice merge (ElevenLabs pre-generated MP3)
  const voiceUrl = post.platform_data?.voice_url as string | undefined;
  if (voiceUrl) {
    try {
      const res = await fetch(voiceUrl);
      if (res.ok) {
        const audioBuffer = Buffer.from(await res.arrayBuffer());
        finalBuffer = await mergeAudioVideo({ videoUrl: "", audioBuffer, videoBuffer: finalBuffer });
      }
    } catch { /* voice merge failed — use concat-only video */ }
  }

  const finalPath = `${workspaceId}/videos/${post.id}-final.mp4`;
  const { error: uploadErr } = await admin.storage
    .from("workspace-media")
    .upload(finalPath, finalBuffer, { contentType: "video/mp4", upsert: true });

  if (uploadErr) {
    return { status: "failed", error: "Error subiendo video final a Storage" };
  }

  const { data: { publicUrl } } = admin.storage.from("workspace-media").getPublicUrl(finalPath);

  await admin.from("generated_posts").update({
    media_urls: [publicUrl],
    platform_data: { ...post.platform_data, clip_jobs: clipJobs },
  }).eq("id", post.id);

  console.log(`[VideoProcessor] completed → ${publicUrl}`);
  return {
    status: "completed",
    mediaUrls: [publicUrl],
    caption: post.caption,
    hashtags: post.hashtags ?? [],
  };
}

// ── Single-clip path (Kling or NanoBanana) ───────────────────────────────────

async function runSingleClipStep(
  post: GeneratedPostRow,
  klingKey: string,
  workspaceId: string,
  admin: SupabaseClient,
  nanoBananaKey?: string,
): Promise<VideoProcessResult> {
  if (!post.ai_job_id) return { status: "failed", error: "No ai_job_id" };

  const jobStatus = await pollJobStatus(
    {
      provider: post.ai_provider as "nano_banana" | "kling",
      jobId: post.ai_job_id,
      type: ((post.platform_data?.jobType as string | undefined) ?? "image") as "image" | "video" | "copy",
    },
    nanoBananaKey,
    klingKey,
    post.platform_data as { referenceImageUrl?: string; jobType?: string } | undefined,
  );

  if (jobStatus.status === "failed") {
    return { status: "failed", error: jobStatus.error ?? "Falló" };
  }

  if (jobStatus.status !== "completed") {
    return { status: "processing", progress: 50 };
  }

  // Build DB updates
  const updates: Record<string, unknown> = {};
  let finalVideoUrl: string | undefined;

  if ("imageUrl" in jobStatus && jobStatus.imageUrl) {
    updates.media_urls = [jobStatus.imageUrl];
  }

  if ("videoUrl" in jobStatus && jobStatus.videoUrl) {
    const voiceUrl = post.platform_data?.voice_url as string | undefined;

    if (voiceUrl) {
      try {
        const audioRes = await fetch(voiceUrl);
        if (!audioRes.ok) throw new Error(`Audio fetch: ${audioRes.status}`);
        const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
        const mergedBuffer = await mergeAudioVideo({ videoUrl: jobStatus.videoUrl, audioBuffer });

        const mergedPath = `${workspaceId}/videos/${post.id}-voiced.mp4`;
        const { error: uploadErr } = await admin.storage
          .from("workspace-media")
          .upload(mergedPath, mergedBuffer, { contentType: "video/mp4", upsert: true });

        if (!uploadErr) {
          const { data: { publicUrl } } = admin.storage.from("workspace-media").getPublicUrl(mergedPath);
          updates.media_urls = [publicUrl];
          finalVideoUrl = publicUrl;
        } else {
          updates.media_urls = [jobStatus.videoUrl];
          finalVideoUrl = jobStatus.videoUrl;
        }
      } catch {
        updates.media_urls = [jobStatus.videoUrl];
        finalVideoUrl = jobStatus.videoUrl;
      }
    } else {
      updates.media_urls = [jobStatus.videoUrl];
      finalVideoUrl = jobStatus.videoUrl;
    }
  }

  if ("caption" in jobStatus && jobStatus.caption) updates.caption = jobStatus.caption;
  if ("hashtags" in jobStatus && jobStatus.hashtags) updates.hashtags = jobStatus.hashtags;

  if (Object.keys(updates).length > 0) {
    await admin.from("generated_posts").update(updates).eq("id", post.id);
  }

  const mediaUrls =
    (updates.media_urls as string[] | undefined) ??
    (finalVideoUrl ? [finalVideoUrl] : []);

  return {
    status: "completed",
    mediaUrls,
    caption: (updates.caption as string | null | undefined) ?? post.caption,
    hashtags: (updates.hashtags as string[] | undefined) ?? post.hashtags ?? [],
  };
}
