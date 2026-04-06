// Nano Banana Pro API — https://gateway.bananapro.site

export interface NanoBananaGenerateImageRequest {
  prompt: string;
  negativePrompt?: string;
  resolution?: "1K" | "2K" | "4K";
  aspectRatio?: "1:1" | "9:16" | "16:9" | "4:3" | "3:4";
  imageUrls?: string[];
  width?: number;
  height?: number;
}

export interface NanoBananaResult {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  imageUrl?: string;
  error?: string;
}

// Loose type — we log the raw response so we can learn the real shape
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyJson = any;

export class NanoBananaClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = "https://gateway.bananapro.site/api/v1";
  }

  private get headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  /** POST /images/generate — returns task_id OR image_url if sync */
  async generateImage(req: NanoBananaGenerateImageRequest): Promise<NanoBananaResult> {
    const aspectRatio: string =
      req.aspectRatio ??
      (req.height && req.width
        ? req.height > req.width ? "9:16" : req.width > req.height ? "16:9" : "1:1"
        : "1:1");

    const payload: Record<string, unknown> = {
      model: "nano-banana-pro",
      prompt: req.prompt,
      resolution: req.resolution ?? "1K",
      aspect_ratio: aspectRatio,
      type: req.imageUrls?.length ? "image-to-image" : "text-to-image",
    };
    if (req.imageUrls?.length) payload.image_urls = req.imageUrls;

    const res = await fetch(`${this.baseUrl}/images/generate`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const raw: AnyJson = await res.json().catch(() => ({}));
    console.log("[NanaBanana] generate response status:", res.status, JSON.stringify(raw));

    if (!res.ok) {
      throw new Error(`Nano Banana generate error (${res.status}): ${raw?.message ?? raw?.error ?? res.statusText}`);
    }

    // Extract task_id from various possible locations
    const taskId: string =
      raw?.data?.task_id ??
      raw?.task_id ??
      raw?.id ??
      "";

    // Some setups return the image synchronously
    const imageUrl: string | undefined =
      raw?.data?.image_url ??
      raw?.image_url ??
      raw?.data?.output?.primary_url ??
      raw?.data?.output?.images?.[0]?.url ??
      raw?.output?.primary_url ??
      undefined;

    if (imageUrl) {
      console.log("[NanoBanana] synchronous image URL:", imageUrl);
      return { jobId: taskId || `sync_${Date.now()}`, status: "completed", imageUrl };
    }

    return { jobId: taskId, status: "pending" };
  }

  /** Poll task status — tries multiple endpoint patterns */
  async getJobStatus(jobId: string): Promise<NanoBananaResult> {
    // Try candidate endpoints in order — first success wins
    const candidates = [
      `${this.baseUrl}/images/task/${jobId}`,
      `${this.baseUrl}/tasks/${jobId}`,
      `${this.baseUrl}/images/${jobId}`,
      `${this.baseUrl}/generations/${jobId}`,
    ];

    let lastError = "";
    for (const url of candidates) {
      const res = await fetch(url, { headers: this.headers, cache: "no-store" });
      const raw: AnyJson = await res.json().catch(() => ({}));
      console.log(`[NanoBanana] status ${url} → ${res.status}`, JSON.stringify(raw));

      if (!res.ok) { lastError = `HTTP ${res.status}`; continue; }

      const task = raw?.data ?? raw;
      const rawStatus: string = (task?.status ?? "").toLowerCase();

      const imageUrl: string | undefined =
        task?.image_url ??
        task?.output?.primary_url ??
        task?.output?.images?.[0]?.url ??
        task?.output?.url ??
        task?.result?.image_url ??
        raw?.image_url ??
        undefined;

      const status: NanoBananaResult["status"] =
        imageUrl || ["completed", "success", "succeed", "done"].includes(rawStatus)
          ? "completed"
          : ["failed", "error"].includes(rawStatus)
          ? "failed"
          : "processing";

      return { jobId, status, imageUrl, error: task?.error_message ?? task?.error ?? undefined };
    }

    // All endpoints failed — return processing so frontend keeps polling
    console.error("[NanoBanana] all status endpoints failed:", lastError);
    return { jobId, status: "processing", error: lastError };
  }
}

// generateCopy is handled by OpenAI — kept for type compatibility
export interface NanoBananaGenerateCopyRequest {
  prompt: string;
  platform: string;
}
