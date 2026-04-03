// YouTube Data API v3 — Video upload

export interface YouTubeUploadOptions {
  title: string;
  description: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus?: "public" | "private" | "unlisted";
  madeForKids?: boolean;
}

export class YouTubePublisher {
  constructor(private accessToken: string) {}

  async uploadVideoByUrl(
    videoUrl: string,
    options: YouTubeUploadOptions
  ): Promise<{ id: string }> {
    // Download video first, then upload (YouTube requires direct upload, not URL)
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error("Failed to download video for YouTube upload");

    const videoBlob = await videoRes.blob();

    // Step 1: Initialize resumable upload
    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": videoBlob.type,
          "X-Upload-Content-Length": String(videoBlob.size),
        },
        body: JSON.stringify({
          snippet: {
            title: options.title,
            description: options.description,
            tags: options.tags ?? [],
            categoryId: options.categoryId ?? "22",
          },
          status: {
            privacyStatus: options.privacyStatus ?? "public",
            madeForKids: options.madeForKids ?? false,
          },
        }),
      }
    );

    if (!initRes.ok) {
      const err = await initRes.json();
      throw new Error(`YouTube init error: ${err.error?.message ?? initRes.statusText}`);
    }

    const uploadUrl = initRes.headers.get("Location");
    if (!uploadUrl) throw new Error("No upload URL returned from YouTube");

    // Step 2: Upload the video data
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": videoBlob.type,
        "Content-Length": String(videoBlob.size),
      },
      body: videoBlob,
    });

    const uploadData = await uploadRes.json();
    if (uploadData.error) throw new Error(uploadData.error.message);

    return { id: uploadData.id };
  }
}
