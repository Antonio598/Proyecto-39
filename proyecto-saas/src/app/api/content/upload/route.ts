import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { getPresignedUploadUrl, getAssetTypeFromMime } from "@/lib/storage/upload";
import { handleApiError } from "@/lib/utils/errors";

export async function POST(request: Request) {
  try {
    const { session, workspaceId } = await requireWorkspaceAccess(request);
    const body = await request.json();
    const { fileName, mimeType, fileSize, folder = "uploads", tags = [] } = body;

    if (!fileName || !mimeType) {
      return NextResponse.json({ error: "fileName and mimeType required" }, { status: 400 });
    }

    const { signedUrl, path, publicUrl } = await getPresignedUploadUrl(
      workspaceId,
      fileName,
      folder
    );

    // Pre-create the DB record (will be confirmed after upload)
    const supabase = await createClient();
    const assetType = getAssetTypeFromMime(mimeType);

    const { data: asset, error } = await supabase
      .from("content_library")
      .insert({
        workspace_id: workspaceId,
        uploaded_by: session.user.id,
        asset_type: assetType,
        file_name: fileName,
        storage_path: path,
        public_url: publicUrl,
        file_size: fileSize ?? null,
        mime_type: mimeType,
        tags,
        folder,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data: { asset, signedUrl, publicUrl } });
  } catch (error) {
    return handleApiError(error);
  }
}
