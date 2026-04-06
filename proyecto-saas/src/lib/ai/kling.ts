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

    console.log("[Kling] generate request:", JSON.stringify(body));

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const raw = await res.json().catch(() => ({})) as Record<string, unknown>;
    console.log("[Kling] generate response status:", res.status, JSON.stringify(raw));

    if (!res.ok) {
      const msg =
        (raw.message as string) ??
        ((raw.data as Record<string, unknown>)?.message as string) ??
        (raw.error as string) ??
        res.statusText;
      throw new Error(`Kling API error (${res.status}): ${msg}`);
    }

    const data = raw as {
      code?: number;
      message?: string;
      data?: { task_id?: string; status?: string };
      task_id?: string;
    };

    const taskId = data.data?.task_id ?? data.task_id;
    if (!taskId) {
      throw new Error(`Kling API: no task_id in response — ${JSON.stringify(data)}`);
    }

    console.log("[Kling] task created:", taskId);
    return { jobId: taskId, status: "pending" };
  }

  async getJobStatus(jobId: string): Promise<KlingJobResult> {
    const url = `${this.baseUrl}/api/status?task_id=${encodeURIComponent(jobId)}`;
    const res = await fetch(url, { headers: this.headers, cache: "no-store" });

    const raw = await res.json().catch(() => ({})) as Record<string, unknown>;
    console.log(`[Kling] status ${url} → ${res.status}`, JSON.stringify(raw));

    if (!res.ok) {
      // Return processing so the frontend keeps polling instead of giving up
      return { jobId, status: "processing", error: `HTTP ${res.status}` };
    }

    const task = (raw.data ?? raw) as Record<string, unknown>;
    const rawStatus = ((task.status as string) ?? "").toLowerCase();

    // Response array may contain the video URL directly
    const responseArr = task.response as string[] | undefined;
    const videoUrl: string | undefined =
      (task.video_url as string | undefined) ??
      ((task.output as Record<string, unknown> | undefined)?.video_url as string | undefined) ??
      (Array.isArray(responseArr) && responseArr.length > 0 ? responseArr[0] : undefined) ??
      (raw.video_url as string | undefined);

    const status: KlingJobResult["status"] =
      videoUrl || ["completed", "success", "succeed", "done"].includes(rawStatus)
        ? "completed"
        : ["failed", "error"].includes(rawStatus)
        ? "failed"
        : "processing";

    console.log(`[Kling] jobId=${jobId} rawStatus=${rawStatus} videoUrl=${videoUrl} → ${status}`);
    return { jobId, status, videoUrl };
  }
}
