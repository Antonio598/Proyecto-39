import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { handleApiError } from "@/lib/utils/errors";

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const admin = createAdminClient();

    // Return completed posts AND active in-progress jobs (exclude permanently failed)
    // Filter by ai_job_id IS NOT NULL — all generated posts always have one set
    const { data, error } = await admin
      .from("generated_posts")
      .select("id, caption, hashtags, media_urls, format, ai_provider, ai_job_id, created_at, platform_data")
      .eq("workspace_id", workspaceId)
      .not("ai_job_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const visible = (data ?? []).filter((p) => {
      if (p.media_urls?.length > 0) return true;
      const pd = p.platform_data as Record<string, unknown> | null;
      if (pd?.job_failed) return false;
      return !!p.ai_job_id;
    });

    return NextResponse.json({ data: visible });
  } catch (error) {
    return handleApiError(error);
  }
}
