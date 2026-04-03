import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { handleApiError } from "@/lib/utils/errors";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { session, workspaceId } = await requireWorkspaceAccess(request);
    const { postId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("scheduled_posts")
      .update({
        status: "approved",
        approved_by: session.user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .eq("status", "pending_approval")
      .select()
      .single();

    if (error) throw error;

    await supabase.from("activity_logs").insert({
      workspace_id: workspaceId,
      user_id: session.user.id,
      action: "post.approved",
      entity_type: "post",
      entity_id: postId,
    });

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
