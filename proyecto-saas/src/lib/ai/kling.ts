// Kling AI Video — https://kling3api.com
// Auth: Bearer token (simple key, no JWT)
// POST /api/generate  → { data: { task_id } }
// GET  /api/status?task_id=xxx → { data: { status, response: [videoUrl] } }

const BASE_URL = "https://kling3api.com";

export interface KlingGenerateVideoRequest {
  prompt: string;
  negativePrompt?: string;
  duration?: number;          // seconds (3–15), default 5
  aspectRatio?: "9:16" | "16:9" | "1:1";
  referenceImageUrl?: string;  // single image
  referenceImageUrls?: string[]; // multiple images for story video
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
    // Resolve image URLs — multiple takes priority over single
    const imageUrls = req.referenceImageUrls?.length
      ? req.referenceImageUrls
      : req.referenceImageUrl
      ? [req.referenceImageUrl]
      : [];

    const hasImages = imageUrls.length > 0;
    const taskType = hasImages ? "image_to_video" : "text_to_video";

    const input: Record<string, unknown> = {
      prompt: req.prompt,
      duration: req.duration ?? 5,
      aspect_ratio: req.aspectRatio ?? "9:16",
      mode: "std",
      cfg_scale: 0.5,
    };

    if (req.negativePrompt) input.negative_prompt = req.negativePrompt;

    if (imageUrls.length === 1) {
      input.image_url = imageUrls[0];
    } else if (imageUrls.length > 1) {
      // Some Kling wrappers accept images array for multi-frame story video
      input.image_url = imageUrls[0]; // always set first as primary
      input.images = imageUrls;       // full array for wrappers that support it
    }

    const body = {
      model: "kling",
      task_type: taskType,
      input,
    };

    console.log("[Kling] generate request →", JSON.stringify(body));

    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const raw = await res.json().catch(() => ({})) as Record<string, unknown>;
    console.log("[Kling] generate response →", res.status, JSON.stringify(raw));

    if (!res.ok) {
      const msg =
        (raw.message as string) ??
        ((raw.data as Record<string, unknown>)?.message as string) ??
        (raw.error as string) ??
        res.statusText;
      throw new Error(`Kling API error (${res.status}): ${msg}`);
    }

    const data = (raw.data ?? raw) as Record<string, unknown>;
    const taskId = (data.task_id ?? data.id) as string | undefined;

    if (!taskId) throw new Error(`Kling: no task_id in response — ${JSON.stringify(raw)}`);

    console.log("[Kling] task created:", taskId);
    return { jobId: taskId, status: "pending" };
  }

  async getJobStatus(jobId: string): Promise<KlingJobResult> {
    const url = `${BASE_URL}/api/status?task_id=${encodeURIComponent(jobId)}`;
    const res = await fetch(url, { headers: this.headers, cache: "no-store" });

    const raw = await res.json().catch(() => ({})) as Record<string, unknown>;
    console.log("[Kling] status →", res.status, JSON.stringify(raw));

    if (!res.ok) {
      return { jobId, status: "processing", error: `HTTP ${res.status}` };
    }

    const data = (raw.data ?? raw) as Record<string, unknown>;
    const rawStatus = ((data.status as string) ?? "").toLowerCase();

    // Video URL can be in data.response[] or data.video_url or data.url
    const responseArr = data.response as string[] | undefined;
    const videoUrl: string | undefined =
      (Array.isArray(responseArr) && responseArr.length > 0 ? responseArr[0] : undefined) ??
      (data.video_url as string | undefined) ??
      (data.url as string | undefined) ??
      (raw.video_url as string | undefined);

    const status: KlingJobResult["status"] =
      videoUrl || ["completed", "success", "succeed", "done"].includes(rawStatus)
        ? "completed"
        : ["failed", "error"].includes(rawStatus)
        ? "failed"
        : "processing";

    console.log(`[Kling] jobId=${jobId} rawStatus=${rawStatus} videoUrl=${videoUrl} → ${status}`);
    return { jobId, status, videoUrl, error: data.error_message as string | undefined };
  }
}
