import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { getAssetTypeFromMime } from "@/lib/storage/upload";
import { getStoragePath } from "@/lib/storage/buckets";
import { BUCKETS } from "@/lib/storage/buckets";
import { handleApiError } from "@/lib/utils/errors";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const { session, workspaceId } = await requireWorkspaceAccess(request);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string | null) ?? "uploads";
    const tagsRaw = formData.get("tags") as string | null;
    const tags = tagsRaw ? JSON.parse(tagsRaw) : [];

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const path = getStoragePath(workspaceId, folder, file.name);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: storageError } = await supabase.storage
      .from(BUCKETS.MEDIA)
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (storageError) throw storageError;

    const { data: { publicUrl } } = supabase.storage
      .from(BUCKETS.MEDIA)
      .getPublicUrl(path);

    const assetType = getAssetTypeFromMime(file.type);

    const { data: asset, error: dbError } = await supabase
      .from("content_library")
      .insert({
        workspace_id: workspaceId,
        uploaded_by: session.user.id,
        asset_type: assetType,
        file_name: file.name,
        storage_path: path,
        public_url: publicUrl,
        file_size: file.size,
        mime_type: file.type,
        tags,
        folder,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({ data: { asset, publicUrl, path } });
  } catch (error) {
    return handleApiError(error);
  }
}
