import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/session";
import { getProfileGroupId } from "@/lib/postproxy";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    await requireAuth();
    const { workspaceId } = await params;

    const groupId = await getProfileGroupId();

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("workspaces")
      .update({ postproxy_group_id: groupId })
      .eq("id", workspaceId)
      .select("id, name, postproxy_group_id")
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
