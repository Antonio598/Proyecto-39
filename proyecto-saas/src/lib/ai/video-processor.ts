import { KlingClient } from "./kling";
import { concatVideoClips, mergeAudioVideo, extractLastFrame } from "./merge";
import { pollJobStatus } from "./orchestrator";
import type { SupabaseClient } from "@supabase/supabase-js";

type ClipJob = { scene: number; jobId: string | null; url: string | null };

export type LogEntry = { ts: string; level: "info" | "warn" | "error"; msg: string };

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

// ── Multi-clip state machine (3 × 10s → 30s with continuity) ────────────────

async function runMultiClipStep(
  post: GeneratedPostRow,
  klingKey: string,
  workspaceId: string,
  admin: SupabaseClient,
): Promise<VideoProcessResult> {
  const kling = new KlingClient(klingKey);
  const clipJobs = (post.platform_data?.clip_jobs ?? []) as ClipJob[];
  const prompt = (post.platform_data?.prompt ?? "") as string;
  const aspectRatio = (post.platform_data?.aspect_ratio ?? "9:16") as "9:16" | "16:9" | "1:1";
  const existingLogs = (post.platform_data?.logs ?? []) as LogEntry[];
  const newLogs: LogEntry[] = [];

  const log = (level: LogEntry["level"], msg: string) => {
    const entry: LogEntry = { ts: new Date().toISOString(), level, msg };
    newLogs.push(entry);
    console.log(`[VideoProcessor][${level.toUpperCase()}] ${msg}`);
  };

  const mergedPlatformData = (extra?: Record<string, unknown>) => ({
    ...post.platform_data,
    ...extra,
    logs: [...existingLogs, ...newLogs],
  });

  const saveState = async (extra?: Record<string, unknown>) => {
    await admin.from("generated_posts").update({
      platform_data: mergedPlatformData(extra),
    }).eq("id", post.id);
  };

  const activeClip = clipJobs.find((j) => j.jobId && !j.url);
  const completedCount = clipJobs.filter((j) => j.url).length;

  if (!activeClip) {
    log("warn", `Sin clip activo — completados ${completedCount}/${clipJobs.length}`);
    await saveState();
    return { status: "processing", progress: completedCount * 33 };
  }

  log("info", `Verificando clip ${activeClip.scene} (jobId=${activeClip.jobId})`);

  let clipStatus;
  try {
    clipStatus = await kling.getJobStatus(activeClip.jobId!);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("error", `Error al consultar status de clip ${activeClip.scene}: ${msg}`);
    await saveState();
    return { status: "failed", error: msg };
  }

  log(
    clipStatus.status === "failed" ? "error" : "info",
    `Kling clip ${activeClip.scene} → ${clipStatus.status}${clipStatus.error ? ` (${clipStatus.error})` : ""}${clipStatus.videoUrl ? ` url=${clipStatus.videoUrl}` : ""}`,
  );

  if (clipStatus.status === "failed") {
    await saveState();
    return { status: "failed", error: clipStatus.error ?? "Clip falló en Kling" };
  }

  if (clipStatus.status !== "completed" || !clipStatus.videoUrl) {
    await saveState();
    return { status: "processing", progress: completedCount * 33 + 10 };
  }

  // ── Clip finished ────────────────────────────────────────────────────────────
  activeClip.url = clipStatus.videoUrl;
  log("info", `Clip ${activeClip.scene} completado → ${clipStatus.videoUrl}`);

  const nextClip = clipJobs.find((j) => !j.jobId);

  if (nextClip) {
    // Extract last frame of the completed clip to use as starting frame of next clip
    let referenceImageUrl: string | undefined;
    try {
      log("info", `Extrayendo último frame de clip ${activeClip.scene} para continuidad…`);
      const frameBuffer = await extractLastFrame({ videoUrl: clipStatus.videoUrl });

      const framePath = `${workspaceId}/frames/${post.id}-clip${activeClip.scene}-frame.jpg`;
      const { error: uploadErr } = await admin.storage
        .from("workspace-media")
        .upload(framePath, frameBuffer, { contentType: "image/jpeg", upsert: true });

      if (!uploadErr) {
        const { data: { publicUrl } } = admin.storage.from("workspace-media").getPublicUrl(framePath);
        referenceImageUrl = publicUrl;
        log("info", `Frame extraído y subido → ${publicUrl}`);
      } else {
        log("warn", `No se pudo subir el frame: ${uploadErr.message} — clip ${nextClip.scene} usará prompt sin imagen`);
      }
    } catch (err) {
      log("warn", `Frame extraction falló: ${err instanceof Error ? err.message : String(err)} — continuando sin frame`);
    }

    // Start next clip
    let newJob;
    try {
      log("info", `Iniciando clip ${nextClip.scene}${referenceImageUrl ? " (desde último frame)" : " (sin frame)"}`);
      newJob = await kling.generateVideo({
        prompt,
        aspectRatio,
        duration: 10,
        sound: false,
        referenceImageUrl,
      });
      nextClip.jobId = newJob.jobId;
      log("info", `Clip ${nextClip.scene} iniciado → jobId=${newJob.jobId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log("error", `Error al iniciar clip ${nextClip.scene}: ${msg}`);
      await saveState({ clip_jobs: clipJobs });
      return { status: "failed", error: `No se pudo iniciar clip ${nextClip.scene}: ${msg}` };
    }

    await saveState({ clip_jobs: clipJobs });
    return { status: "processing", progress: (completedCount + 1) * 33 };
  }

  // ── All clips done → FFmpeg concat ──────────────────────────────────────────
  log("info", `Todos los ${clipJobs.length} clips completados. Concatenando con FFmpeg…`);
  const allUrls = clipJobs.map((j) => j.url!);

  let finalBuffer: Buffer;
  try {
    finalBuffer = await concatVideoClips({ videoUrls: allUrls });
    log("info", `FFmpeg concat exitoso — ${(finalBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("error", `FFmpeg concat falló: ${msg}`);
    await saveState({ clip_jobs: clipJobs });
    return { status: "failed", error: `FFmpeg concat: ${msg}` };
  }

  // Optional voice merge
  const voiceUrl = post.platform_data?.voice_url as string | undefined;
  if (voiceUrl) {
    try {
      log("info", "Mezclando audio de voz (ElevenLabs)…");
      const res = await fetch(voiceUrl);
      if (res.ok) {
        const audioBuffer = Buffer.from(await res.arrayBuffer());
        finalBuffer = await mergeAudioVideo({ videoUrl: "", audioBuffer, videoBuffer: finalBuffer });
        log("info", "Mezcla de audio completada");
      } else {
        log("warn", `No se pudo descargar el audio (${res.status}) — video sin voz`);
      }
    } catch (err) {
      log("warn", `Voice merge falló: ${err instanceof Error ? err.message : String(err)} — video sin voz`);
    }
  }

  const finalPath = `${workspaceId}/videos/${post.id}-final.mp4`;
  log("info", `Subiendo video final a Storage…`);

  const { error: uploadErr } = await admin.storage
    .from("workspace-media")
    .upload(finalPath, finalBuffer, { contentType: "video/mp4", upsert: true });

  if (uploadErr) {
    log("error", `Error subiendo a Storage: ${uploadErr.message}`);
    await saveState({ clip_jobs: clipJobs });
    return { status: "failed", error: "Error subiendo video final a Storage" };
  }

  const { data: { publicUrl } } = admin.storage.from("workspace-media").getPublicUrl(finalPath);
  log("info", `Video final listo → ${publicUrl}`);

  await admin.from("generated_posts").update({
    media_urls: [publicUrl],
    platform_data: mergedPlatformData({ clip_jobs: clipJobs }),
  }).eq("id", post.id);

  return {
    status: "completed",
    mediaUrls: [publicUrl],
    caption: post.caption,
    hashtags: post.hashtags ?? [],
  };
}

// ── Single-clip path ─────────────────────────────────────────────────────────

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

  if (jobStatus.status === "failed") return { status: "failed", error: jobStatus.error ?? "Falló" };
  if (jobStatus.status !== "completed") return { status: "processing", progress: 50 };

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

  return {
    status: "completed",
    mediaUrls: (updates.media_urls as string[] | undefined) ?? (finalVideoUrl ? [finalVideoUrl] : []),
    caption: (updates.caption as string | null | undefined) ?? post.caption,
    hashtags: (updates.hashtags as string[] | undefined) ?? post.hashtags ?? [],
  };
}
