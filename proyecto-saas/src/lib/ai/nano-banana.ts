// Nano Banana API client — keys are stored per workspace in brand_settings or workspace metadata

export interface NanoBananaGenerateImageRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfgScale?: number;
  style?: string;
}

export interface NanoBananaGenerateCopyRequest {
  prompt: string;
  platform: string;
  tone?: string;
  language?: string;
  useHashtags?: boolean;
  useEmojis?: boolean;
  maxLength?: number;
}

export interface NanoBananaResult {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  imageUrl?: string;
  caption?: string;
  hashtags?: string[];
  error?: string;
}

interface BananaResponse {
  task_id?: string;
  data?: {
    task_id?: string;
    status?: string;
    output?: {
      primary_url?: string;
      images?: { url?: string }[];
    };
    error_message?: string;
  };
  status?: string;
  output?: {
    primary_url?: string;
    images?: { url?: string }[];
  };
  error_message?: string;
}

export class NanoBananaClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? "https://gateway.bananapro.site/api/v1";
  }

  private async request<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(`Nano Banana API error: ${err.message ?? err.error?.message ?? res.statusText}`);
    }

    return res.json();
  }

  async generateImage(req: NanoBananaGenerateImageRequest): Promise<NanoBananaResult> {
    const payload = {
      model: "nano-banana-pro",
      prompt: req.prompt,
      resolution: "1K", // "2K" or "4K" could be used based on config
      aspect_ratio: req.height && req.width 
        ? req.height > req.width ? "9:16" : req.width > req.height ? "16:9" : "1:1"
        : "1:1"
    };

    const res = await this.request<BananaResponse>("/images/generate", payload);
    
    // Fallback parsing just in case response changes slightly
    const taskId = res.data?.task_id || res.task_id;
    
    return {
      jobId: taskId || "",
      status: "pending",
    };
  }

  async generateCopy(_req: NanoBananaGenerateCopyRequest): Promise<NanoBananaResult> {
    throw new Error("Not implemented (use OpenAI API directly)");
  }

  async getJobStatus(jobId: string): Promise<NanoBananaResult> {
    const res = await this.request<BananaResponse>(`/images/${jobId}`, undefined, "GET");
    const task = res.data ?? res;

    let mappedStatus: NanoBananaResult["status"] = "pending";
    if (task.status === "completed" || task.status === "succeed" || task.status === "success") {
      mappedStatus = "completed";
    } else if (task.status === "failed") {
      mappedStatus = "failed";
    } else if (task.status === "processing" || task.status === "generating") {
      mappedStatus = "processing";
    }

    return {
      jobId,
      status: mappedStatus,
      imageUrl: task.output?.primary_url ?? task.output?.images?.[0]?.url ?? undefined,
      error: task.error_message ?? undefined,
    };
  }
}

