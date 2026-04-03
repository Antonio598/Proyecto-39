import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { handleApiError } from "@/lib/utils/errors";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const { ruleId } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.isActive !== undefined) updates.is_active = body.isActive;
    if (body.name !== undefined) updates.name = body.name;
    if (body.timeSlots !== undefined) updates.time_slots = body.timeSlots;
    if (body.allowedDays !== undefined) updates.allowed_days = body.allowedDays;
    if (body.publishMode !== undefined) updates.publish_mode = body.publishMode;

    const { data, error } = await supabase
      .from("posting_rules")
      .update(updates)
      .eq("id", ruleId)
      .eq("workspace_id", workspaceId)
      .select("*, social_account:social_accounts(*)")
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const { ruleId } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from("posting_rules")
      .delete()
      .eq("id", ruleId)
      .eq("workspace_id", workspaceId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
