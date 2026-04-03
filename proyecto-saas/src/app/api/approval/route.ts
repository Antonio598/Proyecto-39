import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { handleApiError } from "@/lib/utils/errors";

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("scheduled_posts")
      .select("*, generated_post:generated_posts(*), social_account:social_accounts(*)")
      .eq("workspace_id", workspaceId)
      .eq("status", "pending_approval")
      .order("created_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
