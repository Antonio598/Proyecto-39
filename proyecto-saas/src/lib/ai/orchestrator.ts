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
  referenceImageUrl?: string;   // image URL to use as reference for video generation
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

export function buildSystemPrompt(
  format: PostFormat,
  platform: SocialPlatform,
  tone: string,
  language: string,
  brandContext?: string
): string {
  const platformName = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", linkedin: "LinkedIn", tiktok: "TikTok" }[platform];
  const formatName = {
    image: "imagen", carousel: "carrusel", reel: "Reel", story: "Story",
    short: "YouTube Short", long_video: "video largo", text: "publicación de texto",
  }[format];

  let prompt = `Eres un experto en marketing de contenidos para ${platformName}.
Genera el caption/copy para un ${formatName}.
Idioma: ${language === "es" ? "español" : language}.
Tono: ${tone}.`;

  if (brandContext) {
    prompt += `\nContexto de marca: ${brandContext}`;
  }

  return prompt;
}

export async function startAiGeneration(
  req: AiGenerationRequest
): Promise<AiGenerationJobRef> {
  const isVideo = VIDEO_FORMATS.includes(req.format);
  const isImage = IMAGE_FORMATS.includes(req.format);

  if (isVideo) {
    if (!req.klingKey) {
      throw new Error("Kling API key required for video generation");
    }
    const kling = new KlingClient(req.klingKey);
    const aspectRatio = req.aspectRatio ?? getAspectRatioForFormat(req.format, req.platform);
    const duration = req.format === "long_video" ? 60 : req.format === "short" ? 60 : 30;

    const result = await kling.generateVideo({
      prompt: req.promptText,
      aspectRatio,
      duration,
      referenceImageUrl: req.referenceImageUrl,
    });

    return { provider: "kling", jobId: result.jobId, type: "video" };
  }

  if (isImage) {
    if (!req.nanoBananaKey) {
      throw new Error("Nano Banana API key required for image generation");
    }
    const nb = new NanoBananaClient(req.nanoBananaKey);
    const result = await nb.generateImage({
      prompt: req.promptText,
      width: req.format === "story" ? 1080 : 1080,
      height: req.format === "story" ? 1920 : req.format === "image" ? 1080 : 1350,
    });

    return { provider: "nano_banana", jobId: result.jobId, type: "image" };
  }

  // Text/copy only
  if (!req.nanoBananaKey) {
    throw new Error("Nano Banana API key required for copy generation");
  }
  const nb = new NanoBananaClient(req.nanoBananaKey);
  const result = await nb.generateCopy({
    prompt: req.promptText,
    platform: req.platform,
    tone: req.tone,
    language: req.language,
    useHashtags: req.useHashtags,
    useEmojis: req.useEmojis,
  });

  return { provider: "nano_banana", jobId: result.jobId, type: "copy" };
}

export async function pollJobStatus(
  ref: AiGenerationJobRef,
  nanoBananaKey?: string,
  klingKey?: string
) {
  if (ref.provider === "kling" && klingKey) {
    const kling = new KlingClient(klingKey);
    return kling.getJobStatus(ref.jobId);
  }
  if (ref.provider === "nano_banana" && nanoBananaKey) {
    const nb = new NanoBananaClient(nanoBananaKey);
    return nb.getJobStatus(ref.jobId);
  }
  throw new Error("No API key available for provider: " + ref.provider);
}
