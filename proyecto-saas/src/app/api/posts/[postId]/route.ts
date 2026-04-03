import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { handleApiError, notFound } from "@/lib/utils/errors";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const { postId } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const { scheduledAt, status, caption, hashtags } = body;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (scheduledAt) updates.scheduled_at = scheduledAt;
    if (status) updates.status = status;

    // Update generated post caption/hashtags if provided
    if (caption !== undefined || hashtags !== undefined) {
      const { data: post } = await supabase
        .from("scheduled_posts")
        .select("generated_post_id")
        .eq("id", postId)
        .eq("workspace_id", workspaceId)
        .single();

      if (post?.generated_post_id) {
        const contentUpdates: Record<string, unknown> = {};
        if (caption !== undefined) contentUpdates.caption = caption;
        if (hashtags !== undefined) contentUpdates.hashtags = hashtags;

        await supabase
          .from("generated_posts")
          .update(contentUpdates)
          .eq("id", post.generated_post_id);
      }
    }

    const { data, error } = await supabase
      .from("scheduled_posts")
      .update(updates)
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .select("*, generated_post:generated_posts(*), social_account:social_accounts(*)")
      .single();

    if (error) throw error;
    if (!data) throw notFound("Post");

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const { postId } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from("scheduled_posts")
      .delete()
      .eq("id", postId)
      .eq("workspace_id", workspaceId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
