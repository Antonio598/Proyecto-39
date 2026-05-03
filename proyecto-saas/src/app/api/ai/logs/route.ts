import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { handleApiError } from "@/lib/utils/errors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const admin = createAdminClient();

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await admin
      .from("generated_posts")
      .select("id, caption, created_at, media_urls, ai_provider, ai_job_id, platform_data")
      .eq("workspace_id", workspaceId)
      .eq("ai_provider", "kling")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
