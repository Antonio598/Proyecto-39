import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { handleApiError } from "@/lib/utils/errors";
import { createRuleSchema } from "@/lib/validations/automation.schema";

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("posting_rules")
      .select("*, social_account:social_accounts(*)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { session, workspaceId } = await requireWorkspaceAccess(request);
    const admin = createAdminClient();
    const body = await request.json();

    const parsed = createRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { socialAccountId, name, postsPerDay, postsPerWeek, allowedDays, timeSlots, formats, publishMode, aiPromptId } = parsed.data;

    // aiSettings comes from the form but is not part of the validation schema — stored as jsonb
    const aiSettings = (body.aiSettings as Record<string, unknown>) ?? {};

    const { data, error } = await admin
      .from("posting_rules")
      .insert({
        workspace_id: workspaceId,
        social_account_id: socialAccountId,
        name,
        posts_per_day: postsPerDay ?? null,
        posts_per_week: postsPerWeek ?? null,
        allowed_days: allowedDays,
        time_slots: timeSlots,
        formats,
        publish_mode: publishMode,
        ai_prompt_id: aiPromptId ?? null,
        ai_settings: aiSettings,
        is_active: true,
      })
      .select("*, social_account:social_accounts(*)")
      .single();

    if (error) throw error;

    await admin.from("activity_logs").insert({
      workspace_id: workspaceId,
      user_id: session.user.id,
      action: "rule.created",
      entity_type: "rule",
      entity_id: data.id,
      metadata: { name },
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
