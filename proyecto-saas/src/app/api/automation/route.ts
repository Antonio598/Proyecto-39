import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { handleApiError } from "@/lib/utils/errors";
import { createRuleSchema } from "@/lib/validations/automation.schema";

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const supabase = await createClient();

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
    const supabase = await createClient();
    const body = await request.json();

    const parsed = createRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { socialAccountId, name, postsPerDay, postsPerWeek, allowedDays, timeSlots, formats, publishMode, aiPromptId } = parsed.data;

    const { data, error } = await supabase
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
        is_active: true,
      })
      .select("*, social_account:social_accounts(*)")
      .single();

    if (error) throw error;

    await supabase.from("activity_logs").insert({
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
