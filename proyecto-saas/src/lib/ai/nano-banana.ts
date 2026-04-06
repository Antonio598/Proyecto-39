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

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateImage(req: NanoBananaGenerateImageRequest): Promise<NanoBananaResult> {
    let size = "1024x1024";
    if (req.height && req.width) {
      if (req.height > req.width) size = "1024x1792";
      else if (req.width > req.height) size = "1792x1024";
    }

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: req.prompt,
        n: 1,
        size,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Nano Banana API error: ${err.error?.message ?? res.statusText}`);
    }

    const data = await res.json();
    const url = data.data[0].url;
    
    // Encode the URL into the jobId so we can remain stateless
    const base64UrlEncode = (str: string) => Buffer.from(str).toString("base64url");
    
    return {
      jobId: "dalle-" + base64UrlEncode(url),
      status: "completed",
    };
  }

  async generateCopy(req: NanoBananaGenerateCopyRequest): Promise<NanoBananaResult> {
    throw new Error("Not implemented here (use OpenAI API directly)");
  }

  async getJobStatus(jobId: string): Promise<NanoBananaResult> {
    if (jobId.startsWith("dalle-")) {
      const b64 = jobId.replace("dalle-", "");
      const url = Buffer.from(b64, "base64url").toString("utf-8");
      return {
        jobId,
        status: "completed",
        imageUrl: url,
      };
    }
    throw new Error(`Job not found: ${jobId}`);
  }
}

