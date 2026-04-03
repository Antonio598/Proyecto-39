export const BUCKETS = {
  MEDIA: "workspace-media",
  BRAND: "workspace-brand",
} as const;

export function getStoragePath(workspaceId: string, folder: string, fileName: string): string {
  return `${workspaceId}/${folder}/${Date.now()}-${fileName}`;
}

export function getBrandPath(workspaceId: string, fileName: string): string {
  return `${workspaceId}/${fileName}`;
}
