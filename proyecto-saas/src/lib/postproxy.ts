const POSTPROXY_API_URL = "https://api.postproxy.dev";
const POSTPROXY_API_KEY = process.env.POSTPROXY_API_KEY!;

function headers() {
  return {
    "Authorization": `Bearer ${POSTPROXY_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export type PostproxyPlatform = "facebook" | "instagram" | "linkedin" | "tiktok";

/** Get the profile group ID — uses env var if set, otherwise first group */
async function getProfileGroupId(): Promise<string> {
  if (process.env.POSTPROXY_PROFILE_GROUP_ID) {
    return process.env.POSTPROXY_PROFILE_GROUP_ID;
  }
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
export async function initializeConnection(platform: PostproxyPlatform, redirectUrl: string, groupId?: string) {
  const resolvedGroupId = groupId ?? await getProfileGroupId();
  const res = await fetch(`${POSTPROXY_API_URL}/api/profile_groups/${resolvedGroupId}/initialize_connection`, {
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

export interface PostproxyProfile {
  id: string;
  name: string;
  platform: string;
  status: string;
  profile_group_id: string;
  avatar_url?: string;
  followers_count?: number;
}

/** Get connected profiles, optionally filtered by profile group */
export async function getProfiles(profileGroupId?: string): Promise<PostproxyProfile[]> {
  const url = new URL(`${POSTPROXY_API_URL}/api/profiles`);
  if (profileGroupId) url.searchParams.set("profile_group_id", profileGroupId);

  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) throw new Error(`Postproxy profiles error ${res.status}`);

  const json = await res.json();
  return json.data ?? [];
}

/** Create a new profile group */
export async function createProfileGroup(name: string): Promise<{ id: string; name: string }> {
  const res = await fetch(`${POSTPROXY_API_URL}/api/profile_groups`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? `Postproxy create group error ${res.status}`);
  }

  return res.json();
}

/** Publish a post via Postproxy */
export async function publishPost(params: {
  body: string;
  profiles: string[];      // Postproxy profile IDs
  mediaUrls?: string[];
  mediaType?: "REELS" | "STORY" | "FEED";
  scheduledAt?: string;    // ISO string
}) {
  const payload: Record<string, unknown> = {
    post: { 
      body: params.body,
      ...(params.mediaType && { media_type: params.mediaType })
    },
    profiles: params.profiles,
    media_urls: params.mediaUrls,
    media: params.mediaUrls,
    video_url: params.mediaUrls?.[0], // just in case
    image_urls: params.mediaUrls, // just in case
  };

  if (params.scheduledAt) payload.scheduled_at = params.scheduledAt;

  const res = await fetch(`${POSTPROXY_API_URL}/api/posts`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[Postproxy API Error]", res.status, "Payload sent:", payload, "Response:", err);
    
    // Attempt to extract detailed error messages (often found under err.errors or err.message or err.error)
    const errorMsg = err?.errors 
      ? JSON.stringify(err.errors) 
      : err?.error 
        ? (typeof err.error === 'string' ? err.error : JSON.stringify(err.error))
        : err?.message 
          ? err.message 
          : JSON.stringify(err);

    throw new Error(`Postproxy publish error ${res.status}: ${errorMsg}`);
  }

  return res.json();
}
