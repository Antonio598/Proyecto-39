import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS, getStoragePath } from "./buckets";
import type { AssetType } from "@/types/database";

export function getAssetTypeFromMime(mime: string): AssetType {
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "brand_file";
}

export async function uploadMediaFile(
  workspaceId: string,
  file: File,
  folder = "uploads"
): Promise<{ path: string; publicUrl: string }> {
  const supabase = createAdminClient();
  const path = getStoragePath(workspaceId, folder, file.name);

  const { error } = await supabase.storage
    .from(BUCKETS.MEDIA)
    .upload(path, file, { upsert: false });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKETS.MEDIA)
    .getPublicUrl(path);

  return { path, publicUrl };
}

export async function deleteMediaFile(storagePath: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKETS.MEDIA)
    .remove([storagePath]);
  if (error) throw error;
}

export async function getPresignedUploadUrl(
  workspaceId: string,
  fileName: string,
  folder = "uploads"
): Promise<{ signedUrl: string; path: string; publicUrl: string; token: string }> {
  const supabase = createAdminClient();
  const path = getStoragePath(workspaceId, folder, fileName);

  const { data, error } = await supabase.storage
    .from(BUCKETS.MEDIA)
    .createSignedUploadUrl(path);

  if (error || !data) throw error ?? new Error("Failed to create upload URL");

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKETS.MEDIA)
    .getPublicUrl(path);

  return { signedUrl: data.signedUrl, token: data.token, path, publicUrl };
}
