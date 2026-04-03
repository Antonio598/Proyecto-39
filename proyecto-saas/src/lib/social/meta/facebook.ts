// Meta Graph API — Facebook Page publishing

export class FacebookPublisher {
  constructor(
    private accessToken: string,
    private pageId: string
  ) {}

  private graphUrl(path: string) {
    return `https://graph.facebook.com/v19.0${path}`;
  }

  async publishText(message: string): Promise<{ id: string }> {
    const res = await fetch(this.graphUrl(`/${this.pageId}/feed`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, access_token: this.accessToken }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return { id: data.id };
  }

  async publishPhoto(imageUrl: string, caption: string): Promise<{ id: string }> {
    const res = await fetch(this.graphUrl(`/${this.pageId}/photos`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: imageUrl,
        caption,
        access_token: this.accessToken,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return { id: data.id };
  }

  async publishVideo(videoUrl: string, title: string, description: string): Promise<{ id: string }> {
    const res = await fetch(this.graphUrl(`/${this.pageId}/videos`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_url: videoUrl,
        title,
        description,
        access_token: this.accessToken,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return { id: data.id };
  }
}
