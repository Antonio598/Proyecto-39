// Meta Graph API — Instagram Business publishing

export interface InstagramPublishResult {
  id: string;
  error?: string;
}

export class InstagramPublisher {
  constructor(
    private accessToken: string,
    private igUserId: string
  ) {}

  private graphUrl(path: string) {
    return `https://graph.facebook.com/v19.0${path}`;
  }

  async publishImage(
    imageUrl: string,
    caption: string
  ): Promise<InstagramPublishResult> {
    // Step 1: Create container
    const containerRes = await fetch(
      this.graphUrl(`/${this.igUserId}/media`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          caption,
          access_token: this.accessToken,
        }),
      }
    );
    const container = await containerRes.json();
    if (container.error) throw new Error(container.error.message);

    // Step 2: Publish container
    return this._publish(container.id);
  }

  async publishReel(
    videoUrl: string,
    caption: string
  ): Promise<InstagramPublishResult> {
    const containerRes = await fetch(
      this.graphUrl(`/${this.igUserId}/media`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "REELS",
          video_url: videoUrl,
          caption,
          share_to_feed: true,
          access_token: this.accessToken,
        }),
      }
    );
    const container = await containerRes.json();
    if (container.error) throw new Error(container.error.message);

    // Wait for video processing
    await this._waitForContainer(container.id);
    return this._publish(container.id);
  }

  async publishStory(
    mediaUrl: string,
    isVideo = false
  ): Promise<InstagramPublishResult> {
    const containerRes = await fetch(
      this.graphUrl(`/${this.igUserId}/media`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: isVideo ? "VIDEO" : "IMAGE",
          ...(isVideo ? { video_url: mediaUrl } : { image_url: mediaUrl }),
          media_product_type: "STORY",
          access_token: this.accessToken,
        }),
      }
    );
    const container = await containerRes.json();
    if (container.error) throw new Error(container.error.message);

    if (isVideo) await this._waitForContainer(container.id);
    return this._publish(container.id);
  }

  async publishCarousel(
    mediaUrls: string[],
    caption: string
  ): Promise<InstagramPublishResult> {
    // Create item containers
    const itemIds: string[] = [];
    for (const url of mediaUrls) {
      const res = await fetch(this.graphUrl(`/${this.igUserId}/media`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: url,
          is_carousel_item: true,
          access_token: this.accessToken,
        }),
      });
      const item = await res.json();
      if (item.error) throw new Error(item.error.message);
      itemIds.push(item.id);
    }

    // Create carousel container
    const carouselRes = await fetch(
      this.graphUrl(`/${this.igUserId}/media`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "CAROUSEL",
          caption,
          children: itemIds.join(","),
          access_token: this.accessToken,
        }),
      }
    );
    const carousel = await carouselRes.json();
    if (carousel.error) throw new Error(carousel.error.message);

    return this._publish(carousel.id);
  }

  private async _publish(containerId: string): Promise<InstagramPublishResult> {
    const res = await fetch(
      this.graphUrl(`/${this.igUserId}/media_publish`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: this.accessToken,
        }),
      }
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return { id: data.id };
  }

  private async _waitForContainer(containerId: string, maxAttempts = 20): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const res = await fetch(
        this.graphUrl(`/${containerId}?fields=status_code&access_token=${this.accessToken}`)
      );
      const data = await res.json();
      if (data.status_code === "FINISHED") return;
      if (data.status_code === "ERROR") throw new Error("Video processing failed");
    }
    throw new Error("Container processing timeout");
  }
}
