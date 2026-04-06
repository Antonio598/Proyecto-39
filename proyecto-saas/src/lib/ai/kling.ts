// Kling API client — for video generation (Reels, Shorts, long videos)
import crypto from "crypto";

export interface KlingGenerateVideoRequest {
  prompt: string;
  negativePrompt?: string;
  duration?: number;       // seconds
  aspectRatio?: "9:16" | "16:9" | "1:1";
  style?: string;
  referenceImageUrl?: string;
  model?: "kling-v1" | "kling-v1-5";
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
    this.baseUrl = baseUrl ?? "https://api.klingai.com/v1";
  }

  private get headers() {
    let ak = this.apiKey;
    let sk = "";
    if (this.apiKey.includes(":")) {
      [ak, sk] = this.apiKey.split(":", 2);
    } else if (this.apiKey.includes(",")) {
      [ak, sk] = this.apiKey.split(",", 2);
    } else {
      // Missing SK, fallback to trying raw key or erroring
      sk = ak;
    }

    const header = { alg: "HS256", typ: "JWT" };
    const nbf = Math.floor(Date.now() / 1000) - 5;
    const exp = nbf + 1805;
    const payload = { iss: ak, nbf, exp };

    const base64UrlEncode = (obj: any) =>
      Buffer.from(JSON.stringify(obj)).toString("base64url");

    const unsignedToken = `${base64UrlEncode(header)}.${base64UrlEncode(payload)}`;
    const signature = crypto
      .createHmac("sha256", sk)
      .update(unsignedToken)
      .digest("base64url");

    const token = `${unsignedToken}.${signature}`;

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  async generateVideo(req: KlingGenerateVideoRequest): Promise<KlingJobResult> {
    // Use image2video when a reference image is provided, otherwise text2video
    const endpoint = req.referenceImageUrl
      ? `${this.baseUrl}/videos/image2video`
      : `${this.baseUrl}/videos/text2video`;

    const bodyPayload = req.referenceImageUrl
      ? {
          image_url: req.referenceImageUrl,
          prompt: req.prompt,
          negative_prompt: req.negativePrompt,
          cfg_scale: 0.5,
          mode: "std",
          duration: req.duration ?? 5,
        }
      : {
          prompt: req.prompt,
          negative_prompt: req.negativePrompt,
          cfg_scale: 0.5,
          mode: "std",
          duration: req.duration ?? 5,
          aspect_ratio: req.aspectRatio ?? "9:16",
        };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(bodyPayload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Kling API error: ${err.message ?? res.statusText}`);
    }

    const data = await res.json();
    return {
      jobId: data.data?.task_id ?? data.task_id,
      status: "pending",
    };
  }

  async getJobStatus(jobId: string, isImage2Video = false): Promise<KlingJobResult> {
    const endpoint = isImage2Video
      ? `${this.baseUrl}/videos/image2video/${jobId}`
      : `${this.baseUrl}/videos/text2video/${jobId}`;
    const res = await fetch(endpoint, {
      headers: this.headers,
    });

    const data = await res.json();
    const task = data.data ?? data;

    return {
      jobId,
      status:
        task.task_status === "succeed"
          ? "completed"
          : task.task_status === "failed"
          ? "failed"
          : task.task_status === "processing"
          ? "processing"
          : "pending",
      progress: task.task_progress ?? undefined,
      videoUrl: task.task_result?.videos?.[0]?.url ?? undefined,
      thumbnailUrl: task.task_result?.videos?.[0]?.cover_image_url ?? undefined,
      error: task.task_status_msg ?? undefined,
    };
  }
}
