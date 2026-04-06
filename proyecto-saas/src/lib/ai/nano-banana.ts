// Nano Banana — https://gateway.bananapro.site
// Docs: https://api.bananapro.site/es/api-docs/nano-banana

const BASE_URL = "https://gateway.bananapro.site/api/v1";

export interface NanoBananaGenerateImageRequest {
  prompt: string;
  aspectRatio?: "1:1" | "9:16" | "16:9" | "4:3" | "3:4";
  imageUrls?: string[]; // for image-to-image
  width?: number;
  height?: number;
}

// Not used directly — kept for type compatibility with orchestrator
export interface NanoBananaGenerateCopyRequest {
  prompt: string;
  platform: string;
  tone?: string;
  language?: string;
  useHashtags?: boolean;
  useEmojis?: boolean;
}

export interface NanoBananaResult {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  imageUrl?: string;
  error?: string;
}

export class NanoBananaClient {
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

  private aspectRatioFromDimensions(width?: number, height?: number): string {
    if (!width || !height) return "1:1";
    if (height > width) return "9:16";
    if (width > height) return "16:9";
    return "1:1";
  }

  // POST /api/v1/images/generate
  async generateImage(req: NanoBananaGenerateImageRequest): Promise<NanoBananaResult> {
    const aspectRatio =
      req.aspectRatio ?? this.aspectRatioFromDimensions(req.width, req.height);

    const payload: Record<string, unknown> = {
      model: "nano-banana", // the cheaper/faster model per docs
      prompt: req.prompt,
      aspect_ratio: aspectRatio,
    };

    if (req.imageUrls?.length) {
      payload.type = "image-to-image";
      payload.image_urls = req.imageUrls;
    }

    const res = await fetch(`${BASE_URL}/images/generate`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const raw = await res.json().catch(() => ({})) as Record<string, unknown>;
    console.log("[NanoBanana] generate →", res.status, JSON.stringify(raw));

    if (!res.ok) {
      const msg = (raw?.message ?? raw?.error ?? res.statusText) as string;
      throw new Error(`Nano Banana API error: ${msg}`);
    }

    const taskId = (raw?.data as Record<string, unknown>)?.task_id as string | undefined;
    if (!taskId) throw new Error("Nano Banana: no task_id in response");

    return { jobId: taskId, status: "pending" };
  }

  // GET /api/v1/images/{task_id}
  async getJobStatus(jobId: string): Promise<NanoBananaResult> {
    const res = await fetch(`${BASE_URL}/images/${jobId}`, {
      headers: this.headers,
      cache: "no-store",
    });

    const raw = await res.json().catch(() => ({})) as Record<string, unknown>;
    console.log("[NanoBanana] status →", res.status, JSON.stringify(raw));

    if (!res.ok) {
      // Return processing so the frontend keeps polling
      return { jobId, status: "processing", error: `HTTP ${res.status}` };
    }

    const task = (raw?.data ?? raw) as Record<string, unknown>;
    const rawStatus = ((task?.status ?? "") as string).toLowerCase();

    // Extract image URL from all known locations in the response
    const output = task?.output as Record<string, unknown> | undefined;
    const images = output?.images as Array<Record<string, unknown>> | undefined;

    const imageUrl: string | undefined =
      (task?.image_url as string | undefined) ??
      (output?.primary_url as string | undefined) ??
      (images?.[0]?.url as string | undefined) ??
      (task?.url as string | undefined) ??
      undefined;

    const status: NanoBananaResult["status"] =
      imageUrl ||
      ["completed", "success", "succeed", "done", "complete"].includes(rawStatus)
        ? "completed"
        : ["failed", "error", "cancelled"].includes(rawStatus)
        ? "failed"
        : "processing";

    const errorMsg = (task?.error_message ?? task?.error) as string | undefined;

    return { jobId, status, imageUrl, error: errorMsg };
  }
}
