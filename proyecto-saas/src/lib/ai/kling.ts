// Kling AI — https://kling3api.com
// Auth: Bearer token
// POST /api/generate  (flat body, field "type" selects model)
// GET  /api/status?task_id=xxx

const BASE_URL = "https://kling3api.com";

export interface KlingGenerateVideoRequest {
  prompt: string;
  negativePrompt?: string;
  duration?: number;            // 5 or 10 (Kling supports 5 and 10 seconds)
  aspectRatio?: "9:16" | "16:9" | "1:1";
  referenceImageUrl?: string;   // single image → std-image-to-video
  referenceImageUrls?: string[]; // multiple images → o3-std-reference-to-video
  sound?: boolean;
}

export interface KlingJobResult {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
  error?: string;
}

export class KlingClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private get headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  async generateVideo(req: KlingGenerateVideoRequest): Promise<KlingJobResult> {
    const imageUrls = req.referenceImageUrls?.filter(Boolean) ?? [];
    if (req.referenceImageUrl && imageUrls.length === 0) imageUrls.push(req.referenceImageUrl);

    // Choose the right type based on inputs
    // o3-std-reference-to-video: accepts images[] array (up to 7), great for story video
    // std-image-to-video: single image → video
    // std-text-to-video: no image
    let type: string;
    const body: Record<string, unknown> = {
      prompt: req.prompt,
      duration: req.duration ?? 10,
      aspect_ratio: req.aspectRatio ?? "9:16",
      sound: req.sound ?? false,
      watermark: false,
    };

    if (req.negativePrompt) body.negative_prompt = req.negativePrompt;

    if (imageUrls.length > 1) {
      type = "o3-std-reference-to-video";
      body.images = imageUrls;
    } else if (imageUrls.length === 1) {
      type = "std-image-to-video";
      body.image = imageUrls[0];
      body.cfg_scale = 0.5;
    } else {
      type = "std-text-to-video";
      body.cfg_scale = 0.5;
    }

    body.type = type;

    console.log("[Kling] generate →", JSON.stringify(body));

    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const raw = await res.json().catch(() => ({})) as Record<string, unknown>;
    console.log("[Kling] generate response →", res.status, JSON.stringify(raw));

    if (!res.ok) {
      const msg = (raw.message ?? raw.error ?? res.statusText) as string;
      throw new Error(`Kling error (${res.status}): ${msg}`);
    }

    const data = (raw.data ?? raw) as Record<string, unknown>;
    const taskId = data.task_id as string | undefined;
    if (!taskId) throw new Error(`Kling: no task_id — ${JSON.stringify(raw)}`);

    console.log("[Kling] task created:", taskId, "type:", type);
    return { jobId: taskId, status: "pending" };
  }

  async getJobStatus(jobId: string): Promise<KlingJobResult> {
    const url = `${BASE_URL}/api/status?task_id=${encodeURIComponent(jobId)}`;
    const res = await fetch(url, { headers: this.headers, cache: "no-store" });

    const raw = await res.json().catch(() => ({})) as Record<string, unknown>;
    console.log("[Kling] status →", res.status, JSON.stringify(raw));

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { jobId, status: "failed", error: `Kling: API key inválida (${res.status})` };
      }
      return { jobId, status: "processing", error: `HTTP ${res.status}` };
    }

    const data = (raw.data ?? raw) as Record<string, unknown>;
    const rawStatus = ((data.status as string) ?? "").toUpperCase();

    // Per docs: data.response is an array of video URLs
    const responseArr = data.response as string[] | undefined;
    const videoUrl: string | undefined =
      Array.isArray(responseArr) && responseArr.length > 0
        ? responseArr[0]
        : (data.video_url as string | undefined);

    const status: KlingJobResult["status"] =
      rawStatus === "SUCCESS" || videoUrl
        ? "completed"
        : rawStatus === "FAILED"
        ? "failed"
        : "processing"; // IN_PROGRESS and anything else → keep polling

    const errorMsg = data.error_message as string | undefined;
    console.log(`[Kling] jobId=${jobId} status=${rawStatus} videoUrl=${videoUrl} → ${status}`);

    return { jobId, status, videoUrl, error: errorMsg };
  }
}
