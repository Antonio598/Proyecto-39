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
