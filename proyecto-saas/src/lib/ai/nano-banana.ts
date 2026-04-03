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

export class NanoBananaClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? "https://api.nanabanana.ai/v1";
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(`Nano Banana API error: ${err.message ?? res.statusText}`);
    }

    return res.json();
  }

  async generateImage(req: NanoBananaGenerateImageRequest): Promise<NanoBananaResult> {
    return this.request<NanoBananaResult>("/image/generate", req);
  }

  async generateCopy(req: NanoBananaGenerateCopyRequest): Promise<NanoBananaResult> {
    return this.request<NanoBananaResult>("/copy/generate", req);
  }

  async getJobStatus(jobId: string): Promise<NanoBananaResult> {
    const res = await fetch(`${this.baseUrl}/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    return res.json();
  }
}
