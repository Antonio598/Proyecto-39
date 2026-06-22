import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { handleApiError, ApiError } from "@/lib/utils/errors";

export async function POST(request: Request) {
  try {
    const { session, workspaceId } = await requireWorkspaceAccess(request);
    const body = await request.json();

    const {
      mediaUrl,
      format,
      caption,
      hashtags = [],
      accountIds,
      scheduledAt,
      publishMode = "approval",
      facebookPageData = {},
    } = body;

    if (!format || !accountIds?.length || !scheduledAt) {
      throw new ApiError("format, accountIds y scheduledAt son requeridos", 400);
    }

    const admin = createAdminClient();

    const { data: generatedPost, error: gpError } = await admin
      .from("generated_posts")
      .insert({
        workspace_id: workspaceId,
        created_by: session.user.id,
        format,
        caption: caption ?? "",
        hashtags,
        media_urls: mediaUrl ? [mediaUrl] : [],
        ai_provider: null,
        ai_job_id: null,
      })
      .select()
      .single();

    if (gpError) throw gpError;

    const scheduledPostsToInsert = (accountIds as string[]).map((accountId) => {
      const platformData: Record<string, string> = {};
      const fbData = facebookPageData[accountId];
      if (fbData?.pageId) platformData.facebook_page_id = fbData.pageId;
      if (fbData?.pageName) platformData.facebook_page_name = fbData.pageName;

      return {
        workspace_id: workspaceId,
        generated_post_id: generatedPost.id,
        social_account_id: accountId,
        status: publishMode === "auto" ? "approved" : "pending_approval",
        publish_mode: publishMode,
        scheduled_at: scheduledAt,
        platform_data: platformData,
      };
    });

    const { data: scheduledPosts, error: spError } = await admin
      .from("scheduled_posts")
      .insert(scheduledPostsToInsert)
      .select("id, social_account_id");

    if (spError) throw spError;

    await admin.from("activity_logs").insert({
      workspace_id: workspaceId,
      user_id: session.user.id,
      action: "post.created",
      entity_type: "post",
      entity_id: generatedPost.id,
      metadata: { manual: true, accountCount: accountIds.length },
    });

    return NextResponse.json(
      { data: { generatedPostId: generatedPost.id, scheduledPosts } },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
