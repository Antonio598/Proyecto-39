import { NanoBananaClient } from "./nano-banana";
import { KlingClient } from "./kling";
import type { PostFormat, SocialPlatform } from "@/types/database";

export interface AiGenerationRequest {
  format: PostFormat;
  platform: SocialPlatform;
  promptText: string;
  tone?: string;
  language?: string;
  useHashtags?: boolean;
  useEmojis?: boolean;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  sound?: boolean;
  referenceImageUrl?: string;    // single image
  referenceImageUrls?: string[]; // multiple images for story video
  brandContext?: string;
  nanoBananaKey?: string;
  klingKey?: string;
}

export interface AiGenerationJobRef {
  provider: "nano_banana" | "kling";
  jobId: string;
  type: "image" | "video" | "copy";
}

const VIDEO_FORMATS: PostFormat[] = ["reel", "short", "long_video"];
const IMAGE_FORMATS: PostFormat[] = ["image", "carousel", "story"];

export function getAspectRatioForFormat(
  format: PostFormat,
  platform: SocialPlatform
): "9:16" | "16:9" | "1:1" {
  if (format === "story" || format === "reel" || format === "short") return "9:16";
  if (format === "long_video" && platform === "youtube") return "16:9";
  if (format === "image" && platform === "instagram") return "1:1";
  return "1:1";
}

export async function startAiGeneration(
  req: AiGenerationRequest
): Promise<AiGenerationJobRef> {
  const isVideo = VIDEO_FORMATS.includes(req.format);
  const isImage = IMAGE_FORMATS.includes(req.format);

  // ── VIDEO: Kling ────────────────────────────────────────────────────────
  if (isVideo) {
    if (!req.klingKey) throw new Error("Kling API key required for video generation");

    const kling = new KlingClient(req.klingKey);
    const aspectRatio = req.aspectRatio ?? getAspectRatioForFormat(req.format, req.platform);
    const duration = req.format === "long_video" ? 10 : 5;

    const result = await kling.generateVideo({
      prompt: req.promptText,
      aspectRatio,
      duration,
      sound: req.sound,
      referenceImageUrl: req.referenceImageUrl,
      referenceImageUrls: req.referenceImageUrls,
    });

    return { provider: "kling", jobId: result.jobId, type: "video" };
  }

  // ── IMAGE: Nano Banana ──────────────────────────────────────────────────
  if (isImage) {
    if (!req.nanoBananaKey) throw new Error("Nano Banana API key required for image generation");

    const nb = new NanoBananaClient(req.nanoBananaKey);
    const aspectRatio = req.aspectRatio ?? getAspectRatioForFormat(req.format, req.platform);

    const result = await nb.generateImage({
      prompt: req.promptText,
      aspectRatio,
    });

    return { provider: "nano_banana", jobId: result.jobId, type: "image" };
  }

  // ── TEXT ONLY: no external generation needed ────────────────────────────
  // Copy is handled by OpenAI in /api/ai/script — this path should rarely be hit
  return { provider: "nano_banana", jobId: `text_${Date.now()}`, type: "copy" };
}

export async function pollJobStatus(
  ref: AiGenerationJobRef,
  nanoBananaKey?: string,
  klingKey?: string,
  _platformData?: { referenceImageUrl?: string; jobType?: string }
) {
  if (ref.provider === "kling" && klingKey) {
    const kling = new KlingClient(klingKey);
    return kling.getJobStatus(ref.jobId);
  }

  if (ref.provider === "nano_banana" && nanoBananaKey) {
    // Sync jobs have a special prefix — return immediately as completed
    if (ref.jobId.startsWith("sync_") || ref.jobId.startsWith("text_")) {
      return { jobId: ref.jobId, status: "completed" as const };
    }
    const nb = new NanoBananaClient(nanoBananaKey);
    return nb.getJobStatus(ref.jobId);
  }

  throw new Error("No API key available for provider: " + ref.provider);
}
