const POSTPROXY_API_URL = "https://api.postproxy.dev";
const POSTPROXY_API_KEY = process.env.POSTPROXY_API_KEY!;

function headers() {
  return {
    "Authorization": `Bearer ${POSTPROXY_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export type PostproxyPlatform = "facebook" | "instagram" | "linkedin" | "tiktok";

/** Get the first profile group ID */
async function getProfileGroupId(): Promise<string> {
  const res = await fetch(`${POSTPROXY_API_URL}/api/profile_groups`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Postproxy profile_groups error ${res.status}`);
  const json = await res.json();
  const groups = json.data ?? json;
  if (!groups?.length) throw new Error("No profile groups found in Postproxy account");
  return groups[0].id;
}

/** Generate OAuth URL to connect a social account */
export async function initializeConnection(platform: PostproxyPlatform, redirectUrl: string) {
  const groupId = await getProfileGroupId();
  const res = await fetch(`${POSTPROXY_API_URL}/api/profile_groups/${groupId}/initialize-connection`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ platform, redirect_url: redirectUrl }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? `Postproxy error ${res.status}`);
  }

  return res.json() as Promise<{ url: string; state: string }>;
}

/** Get all connected profiles */
export async function getProfiles() {
  const res = await fetch(`${POSTPROXY_API_URL}/api/profiles`, {
    headers: headers(),
  });

  if (!res.ok) throw new Error(`Postproxy profiles error ${res.status}`);

  const json = await res.json();
  return (json.data ?? json) as Array<{
    id: string;
    platform: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    followers_count?: number;
  }>;
}

/** Publish a post via Postproxy */
export async function publishPost(params: {
  body: string;
  profiles: string[];      // Postproxy profile IDs
  imageUrls?: string[];
  videoUrl?: string;
  scheduledAt?: string;    // ISO string
}) {
  const payload: Record<string, unknown> = {
    post: { body: params.body },
    profiles: params.profiles,
  };

  if (params.imageUrls?.length) payload.image_urls = params.imageUrls;
  if (params.videoUrl) payload.video_url = params.videoUrl;
  if (params.scheduledAt) payload.scheduled_at = params.scheduledAt;

  const res = await fetch(`${POSTPROXY_API_URL}/api/posts`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? `Postproxy publish error ${res.status}`);
  }

  return res.json();
}
