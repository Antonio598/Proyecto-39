import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/utils/errors";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { accountId } = await params;
    const admin = createAdminClient();

    // Get the account to find the Postproxy profile ID
    const { data: account } = await admin
      .from("social_accounts")
      .select("metadata")
      .eq("id", accountId)
      .single();

    // Delete profile from Postproxy so it doesn't reappear on next sync
    const postproxyProfileId = (account?.metadata as Record<string, string> | null)?.postproxy_profile_id;
    if (postproxyProfileId && process.env.POSTPROXY_API_KEY) {
      await fetch(`https://api.postproxy.dev/api/profiles/${postproxyProfileId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${process.env.POSTPROXY_API_KEY}` },
      }).catch(() => {}); // non-fatal: local delete proceeds regardless
    }

    // Delete related scheduled_posts first to avoid FK constraint violation
    await admin.from("scheduled_posts").delete().eq("social_account_id", accountId);

    const { error } = await admin
      .from("social_accounts")
      .delete()
      .eq("id", accountId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { accountId } = await params;
    const body = await request.json();
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("social_accounts")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", accountId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
