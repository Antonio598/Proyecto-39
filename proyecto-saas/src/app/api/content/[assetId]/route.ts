import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { deleteMediaFile } from "@/lib/storage/upload";
import { handleApiError } from "@/lib/utils/errors";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { assetId } = await params;
    const admin = createAdminClient();

    // Get asset to find storage path
    const { data: asset, error: fetchError } = await admin
      .from("content_library")
      .select("storage_path")
      .eq("id", assetId)
      .single();

    if (fetchError || !asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Delete from storage
    try {
      await deleteMediaFile(asset.storage_path);
    } catch {
      // Continue even if storage delete fails
    }

    // Delete DB record
    const { error } = await admin
      .from("content_library")
      .delete()
      .eq("id", assetId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
