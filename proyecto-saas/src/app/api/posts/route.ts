import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { handleApiError } from "@/lib/utils/errors";

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    let query = supabase
      .from("scheduled_posts")
      .select("*, generated_post:generated_posts(*), social_account:social_accounts(*)")
      .eq("workspace_id", workspaceId)
      .order("scheduled_at", { ascending: true });

    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const accountId = searchParams.get("accountId");
    const limit = searchParams.get("limit");

    if (status) query = query.eq("status", status);
    if (from) query = query.gte("scheduled_at", from);
    if (to) query = query.lte("scheduled_at", to);
    if (accountId) query = query.eq("social_account_id", accountId);
    if (limit) query = query.limit(parseInt(limit));

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { session, workspaceId } = await requireWorkspaceAccess(request);
    const supabase = await createClient();
    const body = await request.json();

    const {
      socialAccountId, generatedPostId, scheduledAt,
      publishMode = "approval",
    } = body;

    if (!socialAccountId || !scheduledAt) {
      return NextResponse.json({ error: "socialAccountId and scheduledAt required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("scheduled_posts")
      .insert({
        workspace_id: workspaceId,
        generated_post_id: generatedPostId ?? null,
        social_account_id: socialAccountId,
        status: publishMode === "auto" ? "approved" : "pending_approval",
        publish_mode: publishMode,
        scheduled_at: scheduledAt,
      })
      .select("*, generated_post:generated_posts(*), social_account:social_accounts(*)")
      .single();

    if (error) throw error;

    // Log activity
    await supabase.from("activity_logs").insert({
      workspace_id: workspaceId,
      user_id: session.user.id,
      action: "post.created",
      entity_type: "post",
      entity_id: data.id,
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
