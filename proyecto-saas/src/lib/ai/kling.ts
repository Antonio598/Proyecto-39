// Kling3API client — https://kling3api.com
// Simple Bearer token auth, no JWT needed

export interface KlingGenerateVideoRequest {
  prompt: string;
  negativePrompt?: string;
  duration?: 5 | 10;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  mode?: "std" | "pro";
  version?: string;
  referenceImageUrl?: string; // image-to-video when provided
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
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl ?? "https://kling3api.com").replace(/\/$/, "");
  }

  private get headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  async generateVideo(req: KlingGenerateVideoRequest): Promise<KlingJobResult> {
    const input: Record<string, unknown> = {
      prompt: req.prompt,
      duration: req.duration ?? 5,
      aspect_ratio: req.aspectRatio ?? "9:16",
      mode: req.mode ?? "std",
      version: req.version ?? "2.6",
      cfg_scale: 0.5,
    };

    if (req.negativePrompt) input.negative_prompt = req.negativePrompt;
    if (req.referenceImageUrl) input.image_url = req.referenceImageUrl;

    const body = {
      model: "kling",
      task_type: "video_generation",
      input,
    };

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = (err as { message?: string; error?: string; data?: { message?: string } })
        .message ??
        (err as { data?: { message?: string } }).data?.message ??
        (err as { error?: string }).error ??
        res.statusText;
      throw new Error(`Kling API error (${res.status}): ${msg}`);
    }

    const data = await res.json() as {
      code?: number;
      message?: string;
      data?: { task_id?: string; status?: string };
      task_id?: string;
    };

    const taskId = data.data?.task_id ?? data.task_id;
    if (!taskId) {
      throw new Error(`Kling API: no task_id in response — ${JSON.stringify(data)}`);
    }

    return { jobId: taskId, status: "pending" };
  }

  async getJobStatus(jobId: string): Promise<KlingJobResult> {
    const res = await fetch(`${this.baseUrl}/api/status?task_id=${encodeURIComponent(jobId)}`, {
      headers: this.headers,
      cache: "no-store",
    });

    if (!res.ok) {
      return { jobId, status: "failed", error: `HTTP ${res.status}` };
    }

    const data = await res.json() as {
      code?: number;
      message?: string;
      data?: {
        task_id?: string;
        status?: string;
        response?: string[];
        video_url?: string;
        output?: { video_url?: string };
      };
      status?: string;
      response?: string[];
    };

    const task = data.data ?? data;
    const rawStatus = ((task as { status?: string }).status ?? "").toLowerCase();

    const status: KlingJobResult["status"] =
      rawStatus === "completed" || rawStatus === "success" || rawStatus === "succeed"
        ? "completed"
        : rawStatus === "failed" || rawStatus === "error"
        ? "failed"
        : "processing";

    // Extract video URL from various possible response shapes
    const responseArr = (task as { response?: string[] }).response;
    const videoUrl: string | undefined =
      (task as { video_url?: string }).video_url ??
      (task as { output?: { video_url?: string } }).output?.video_url ??
      (Array.isArray(responseArr) && responseArr.length > 0 ? responseArr[0] : undefined);

    return { jobId, status, videoUrl };
  }
}
