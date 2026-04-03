"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { ImageIcon, Video, Music, FileText, Upload, Trash2, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";
import type { ContentAsset, AssetType } from "@/types/database";

const TYPE_FILTERS: { label: string; value: AssetType | "all"; icon: React.ElementType }[] = [
  { label: "Todos", value: "all", icon: FileText },
  { label: "Fotos", value: "photo", icon: ImageIcon },
  { label: "Videos", value: "video", icon: Video },
  { label: "Audio", value: "audio", icon: Music },
  { label: "Logos", value: "logo", icon: ImageIcon },
];

async function fetchAssets(workspaceId: string, type?: string) {
  const params = new URLSearchParams();
  if (type && type !== "all") params.set("type", type);
  const res = await fetch(`/api/content?${params}`, {
    headers: { "x-workspace-id": workspaceId },
  });
  const json = await res.json();
  return json.data as ContentAsset[];
}

export default function ContentPage() {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<AssetType | "all">("all");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["assets", activeWorkspaceId, filterType],
    queryFn: () => fetchAssets(activeWorkspaceId!, filterType),
    enabled: !!activeWorkspaceId,
  });

  const filteredAssets = assets.filter((a) =>
    search ? a.file_name.toLowerCase().includes(search.toLowerCase()) : true
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!activeWorkspaceId || uploading) return;
      setUploading(true);
      let success = 0;

      for (const file of acceptedFiles) {
        try {
          // 1. Get presigned URL
          const res = await fetch("/api/content/upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-workspace-id": activeWorkspaceId,
            },
            body: JSON.stringify({
              fileName: file.name,
              mimeType: file.type,
              fileSize: file.size,
            }),
          });
          const { data } = await res.json();

          // 2. Upload directly to Supabase Storage
          await fetch(data.signedUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
          });

          success++;
        } catch {
          toast.error(`Error al subir ${file.name}`);
        }
      }

      if (success > 0) {
        toast.success(`${success} archivo${success > 1 ? "s" : ""} subido${success > 1 ? "s" : ""}`);
        queryClient.invalidateQueries({ queryKey: ["assets", activeWorkspaceId] });
      }
      setUploading(false);
    },
    [activeWorkspaceId, uploading, queryClient]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [],
      "video/*": [],
      "audio/*": [],
    },
    maxSize: 500 * 1024 * 1024, // 500MB
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-indigo-600" />
            Banco multimedia
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {assets.length} archivo{assets.length !== 1 ? "s" : ""} en tu biblioteca
          </p>
        </div>
      </div>

      {/* Upload zone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
          isDragActive
            ? "border-indigo-400 bg-indigo-50"
            : "border-border hover:border-indigo-300 hover:bg-muted/40",
          uploading && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
      >
        <input {...getInputProps()} />
        <Upload className={cn("w-10 h-10 mx-auto mb-3", isDragActive ? "text-indigo-500" : "text-muted-foreground/50")} />
        <p className="font-medium text-sm">
          {uploading ? "Subiendo archivos..." : isDragActive ? "Suelta los archivos aquí" : "Arrastra archivos o haz clic para seleccionar"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Fotos, videos, audio · Máximo 500MB por archivo
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar archivos..."
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {TYPE_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setFilterType(value as AssetType | "all")}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md font-medium transition-colors",
                filterType === value
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="text-center py-16">
          <ImageIcon className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
          <p className="font-medium">No hay archivos</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? "No hay resultados para tu búsqueda" : "Sube tus primeros archivos usando el área de arriba"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredAssets.map((asset) => (
            <div key={asset.id} className="group relative aspect-square rounded-xl overflow-hidden bg-muted border">
              {asset.asset_type === "photo" || asset.asset_type === "logo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset.public_url}
                  alt={asset.file_name}
                  className="w-full h-full object-cover"
                />
              ) : asset.asset_type === "video" ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                  <Video className="w-8 h-8 text-white/60" />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FileText className="w-8 h-8 text-muted-foreground/40" />
                </div>
              )}

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                <button className="self-end p-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <p className="text-white text-xs truncate font-medium">{asset.file_name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
