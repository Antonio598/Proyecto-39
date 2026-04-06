// Kling AI Video — https://kling3api.com
// Docs: https://kling3api.com/docs
// Auth: Bearer token (single API key — no JWT required)
// Endpoints:
//   POST https://kling3api.com/api/generate  → { data: { task_id, status, ... } }
//   GET  https://kling3api.com/api/status?task_id=xxx → { data: { status, response: [videoUrl] } }

const BASE_URL = "https://kling3api.com";

export interface KlingGenerateVideoRequest {
  prompt: string;
  negativePrompt?: string;
  duration?: number;        // seconds (3–15), default 5
  aspectRatio?: "9:16" | "16:9" | "1:1";
  referenceImageUrl?: string;
  model?: "std" | "pro";   // maps to std-text-to-video / pro-text-to-video etc.
}

export interface KlingJobResult {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

export class KlingClient {
  private apiKey: string;

  constructor(apiKey: string) {
    // Support old format "ak:sk" — just use the whole string as bearer token
    // (kling3api.com uses a single simple key, not JWT)
    this.apiKey = apiKey;
  }

  private get headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  // POST /api/generate
  async generateVideo(req: KlingGenerateVideoRequest): Promise<KlingJobResult> {
    const isImg2Vid = !!req.referenceImageUrl;
    const tier = req.model === "pro" ? "pro" : "std";
    const taskType = isImg2Vid ? `${tier}-image-to-video` : `${tier}-text-to-video`;

    const payload: Record<string, unknown> = {
      type: taskType,
      prompt: req.prompt,
      duration: req.duration ?? 5,
      aspect_ratio: req.aspectRatio ?? "9:16",
    };

    if (req.negativePrompt) payload.negative_prompt = req.negativePrompt;
    if (isImg2Vid) payload.image_url = req.referenceImageUrl;

    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const raw = await res.json().catch(() => ({})) as Record<string, unknown>;
    console.log("[Kling] generate →", res.status, JSON.stringify(raw));

    if (!res.ok) {
      const msg = (raw?.message ?? raw?.error ?? res.statusText) as string;
      throw new Error(`Kling API error: ${msg}`);
    }

    const data = (raw?.data ?? raw) as Record<string, unknown>;
    const taskId = (data?.task_id ?? data?.id) as string | undefined;

    if (!taskId) throw new Error(`Kling: no task_id in response: ${JSON.stringify(raw)}`);

    return { jobId: taskId, status: "pending" };
  }

  // GET /api/status?task_id=xxx
  async getJobStatus(jobId: string): Promise<KlingJobResult> {
    const url = `${BASE_URL}/api/status?task_id=${encodeURIComponent(jobId)}`;
    const res = await fetch(url, {
      headers: this.headers,
      cache: "no-store",
    });

    const raw = await res.json().catch(() => ({})) as Record<string, unknown>;
    console.log("[Kling] status →", res.status, JSON.stringify(raw));

    if (!res.ok) {
      return { jobId, status: "processing", error: `HTTP ${res.status}` };
    }

    const data = (raw?.data ?? raw) as Record<string, unknown>;
    const rawStatus = ((data?.status ?? "") as string).toUpperCase();

    // Per docs: data.response is an array of video URLs
    const responseArr = data?.response as string[] | undefined;
    const videoUrl: string | undefined =
      Array.isArray(responseArr) && responseArr.length > 0
        ? responseArr[0]
        : (data?.video_url as string | undefined) ??
          (data?.url as string | undefined) ??
          undefined;

    const status: KlingJobResult["status"] =
      videoUrl || rawStatus === "COMPLETED" || rawStatus === "SUCCEED" || rawStatus === "SUCCESS"
        ? "completed"
        : rawStatus === "FAILED" || rawStatus === "ERROR"
        ? "failed"
        : "processing";

    const errorMsg = (data?.error_message ?? data?.error) as string | undefined;

    return {
      jobId,
      status,
      videoUrl,
      error: errorMsg,
    };
  }
}
