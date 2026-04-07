import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { handleApiError } from "@/lib/utils/errors";

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const admin = createAdminClient();

    // Return generated posts that have actual media (images or videos)
    const { data, error } = await admin
      .from("generated_posts")
      .select("id, caption, hashtags, media_urls, format, ai_provider, created_at, platform_data")
      .eq("workspace_id", workspaceId)
      .not("media_urls", "eq", "{}")   // has at least one url
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    // Filter out records where media_urls is empty array
    const withMedia = (data ?? []).filter((p) => p.media_urls?.length > 0);

    return NextResponse.json({ data: withMedia });
  } catch (error) {
    return handleApiError(error);
  }
}
