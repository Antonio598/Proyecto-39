"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import {
  ImageIcon, Video, Music, FileText, Upload, Trash2, Search,
  Sparkles, Download, Calendar, Copy,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { ContentAsset, AssetType } from "@/types/database";

const TYPE_FILTERS: { label: string; value: AssetType | "all"; icon: React.ElementType }[] = [
  { label: "Todos", value: "all", icon: FileText },
  { label: "Fotos", value: "photo", icon: ImageIcon },
  { label: "Videos", value: "video", icon: Video },
  { label: "Audio", value: "audio", icon: Music },
  { label: "Logos", value: "logo", icon: ImageIcon },
];

const FORMAT_LABELS: Record<string, string> = {
  reel: "Reel", short: "Short", image: "Imagen", carousel: "Carrusel",
  story: "Story", long_video: "Video largo", text: "Texto",
};

interface GeneratedPost {
  id: string;
  caption: string | null;
  hashtags: string[];
  media_urls: string[];
  format: string;
  ai_provider: string;
  created_at: string;
  platform_data: { platform?: string } | null;
}

async function fetchAssets(workspaceId: string, type?: string) {
  const params = new URLSearchParams();
  if (type && type !== "all") params.set("type", type);
  const res = await fetch(`/api/content?${params}`, { headers: { "x-workspace-id": workspaceId } });
  return ((await res.json()).data ?? []) as ContentAsset[];
}

async function fetchGeneratedPosts(workspaceId: string) {
  const res = await fetch("/api/generated-posts", { headers: { "x-workspace-id": workspaceId } });
  return ((await res.json()).data ?? []) as GeneratedPost[];
}

function isVideo(url: string) {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

export default function ContentPage() {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"bank" | "generated">("bank");
  const [filterType, setFilterType] = useState<AssetType | "all">("all");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewPost, setPreviewPost] = useState<GeneratedPost | null>(null);

  // ── Bank assets ───────────────────────────────────────────────────────────
  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ["assets", activeWorkspaceId, filterType],
    queryFn: () => fetchAssets(activeWorkspaceId!, filterType),
    enabled: !!activeWorkspaceId && tab === "bank",
  });

  const filteredAssets = assets.filter((a) =>
    search ? a.file_name.toLowerCase().includes(search.toLowerCase()) : true
  );

  // ── Generated posts ───────────────────────────────────────────────────────
  const { data: generatedPosts = [], isLoading: generatedLoading } = useQuery({
    queryKey: ["generated-posts", activeWorkspaceId],
    queryFn: () => fetchGeneratedPosts(activeWorkspaceId!),
    enabled: !!activeWorkspaceId && tab === "generated",
  });

  const filteredGenerated = generatedPosts.filter((p) =>
    search
      ? (p.caption ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.format ?? "").toLowerCase().includes(search.toLowerCase())
      : true
  );

  // ── Upload ────────────────────────────────────────────────────────────────
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!activeWorkspaceId || uploading) return;
      setUploading(true);
      let success = 0;
      for (const file of acceptedFiles) {
        try {
          const res = await fetch("/api/content/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-workspace-id": activeWorkspaceId },
            body: JSON.stringify({ fileName: file.name, mimeType: file.type, fileSize: file.size }),
          });
          const { data } = await res.json();
          const supabase = createClient();
          const { error: uploadError } = await supabase.storage
            .from("workspace-media")
            .uploadToSignedUrl(data.path, data.token, file);
          if (uploadError) throw uploadError;
          success++;
        } catch (error) {
          console.error("Upload error:", error);
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

  const deleteMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const res = await fetch(`/api/content/${assetId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
    },
    onSuccess: () => {
      toast.success("Archivo eliminado");
      queryClient.invalidateQueries({ queryKey: ["assets", activeWorkspaceId] });
    },
    onError: () => toast.error("Error al eliminar el archivo"),
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [], "video/*": [], "audio/*": [] },
    maxSize: 500 * 1024 * 1024,
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-indigo-600" />
            Contenido
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {tab === "bank"
              ? `${assets.length} archivo${assets.length !== 1 ? "s" : ""} en tu biblioteca`
              : `${generatedPosts.length} pieza${generatedPosts.length !== 1 ? "s" : ""} generadas con IA`}
          </p>
        </div>
        {tab === "generated" && (
          <Link href="/create/ai"
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            <Sparkles className="w-4 h-4" /> Crear con IA
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("bank")}
          className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            tab === "bank" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          <Upload className="w-4 h-4" /> Banco multimedia
        </button>
        <button
          onClick={() => setTab("generated")}
          className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            tab === "generated" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          <Sparkles className="w-4 h-4" /> Generado con IA
          {generatedPosts.length > 0 && tab !== "generated" && (
            <span className="bg-indigo-600 text-white text-xs px-1.5 py-0.5 rounded-full">{generatedPosts.length}</span>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "bank" ? "Buscar archivos..." : "Buscar contenido..."}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        {tab === "bank" && (
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {TYPE_FILTERS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setFilterType(value as AssetType | "all")}
                className={cn("px-3 py-1.5 text-xs rounded-md font-medium transition-colors",
                  filterType === value ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── BANK TAB ──────────────────────────────────────────────────────── */}
      {tab === "bank" && (
        <>
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
              isDragActive ? "border-indigo-400 bg-indigo-50" : "border-border hover:border-indigo-300 hover:bg-muted/40",
              uploading && "opacity-50 cursor-not-allowed pointer-events-none"
            )}
          >
            <input {...getInputProps()} />
            <Upload className={cn("w-10 h-10 mx-auto mb-3", isDragActive ? "text-indigo-500" : "text-muted-foreground/50")} />
            <p className="font-medium text-sm">
              {uploading ? "Subiendo archivos..." : isDragActive ? "Suelta los archivos aquí" : "Arrastra archivos o haz clic para seleccionar"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Fotos, videos, audio · Máximo 500MB por archivo</p>
          </div>

          {assetsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />)}
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
                    <img src={asset.public_url} alt={asset.file_name} className="w-full h-full object-cover" />
                  ) : asset.asset_type === "video" ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-900">
                      <Video className="w-8 h-8 text-white/60" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileText className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                    <button
                      onClick={() => { if (confirm("¿Eliminar este archivo?")) deleteMutation.mutate(asset.id); }}
                      className="self-end p-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <p className="text-white text-xs truncate font-medium">{asset.file_name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── GENERATED TAB ─────────────────────────────────────────────────── */}
      {tab === "generated" && (
        <>
          {generatedLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : filteredGenerated.length === 0 ? (
            <div className="text-center py-16">
              <Sparkles className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
              <p className="font-medium">No hay contenido generado aún</p>
              <p className="text-sm text-muted-foreground mt-1">Los videos e imágenes creados con IA aparecerán aquí</p>
              <Link href="/create/ai" className="mt-4 inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                <Sparkles className="w-4 h-4" /> Crear con IA
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGenerated.map((post) => {
                const mediaUrl = post.media_urls[0];
                const isVid = isVideo(mediaUrl);
                return (
                  <div key={post.id} className="bg-white rounded-xl border overflow-hidden group hover:shadow-md transition-shadow">
                    {/* Thumbnail */}
                    <div
                      className="relative bg-black cursor-pointer"
                      style={{ aspectRatio: post.format === "reel" || post.format === "short" || post.format === "story" ? "9/16" : "16/9", maxHeight: 280 }}
                      onClick={() => setPreviewPost(post)}
                    >
                      {isVid ? (
                        <video src={mediaUrl} className="w-full h-full object-contain" muted />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl} alt="" className="w-full h-full object-contain" />
                      )}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-sm font-medium bg-black/60 px-3 py-1.5 rounded-lg">
                          {isVid ? "▶ Ver video" : "🔍 Ver imagen"}
                        </span>
                      </div>
                      {/* Format badge */}
                      <span className="absolute top-2 left-2 text-xs bg-black/70 text-white px-2 py-0.5 rounded-full">
                        {FORMAT_LABELS[post.format] ?? post.format}
                      </span>
                      {/* AI badge */}
                      <span className="absolute top-2 right-2 text-xs bg-indigo-600/90 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> IA
                      </span>
                    </div>

                    {/* Info */}
                    <div className="p-3 space-y-2">
                      {post.caption && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{post.caption}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(post.created_at), "d MMM yyyy", { locale: es })}
                        </span>
                        <div className="flex items-center gap-1">
                          <a
                            href={mediaUrl}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                            title="Descargar"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => { navigator.clipboard.writeText(post.caption ?? ""); toast.success("Caption copiado"); }}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                            title="Copiar caption"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <Link
                            href={`/calendar`}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                            title="Programar"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Preview modal */}
      {previewPost && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewPost(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Media */}
            <div className="bg-black flex items-center justify-center" style={{ maxHeight: "60vh" }}>
              {isVideo(previewPost.media_urls[0]) ? (
                <video src={previewPost.media_urls[0]} controls autoPlay className="max-h-[60vh] w-full object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewPost.media_urls[0]} alt="" className="max-h-[60vh] w-full object-contain" />
              )}
            </div>

            {/* Details */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                    {FORMAT_LABELS[previewPost.format] ?? previewPost.format}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(previewPost.created_at), "d MMM yyyy · HH:mm", { locale: es })}
                  </span>
                </div>
                <a href={previewPost.media_urls[0]} download target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                  <Download className="w-3.5 h-3.5" /> Descargar
                </a>
              </div>

              {previewPost.caption && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-muted-foreground">Caption</p>
                    <button onClick={() => { navigator.clipboard.writeText(previewPost.caption ?? ""); toast.success("Copiado"); }}
                      className="text-xs text-indigo-600 flex items-center gap-1 hover:text-indigo-700">
                      <Copy className="w-3 h-3" /> Copiar
                    </button>
                  </div>
                  <p className="text-sm bg-muted/40 rounded-lg p-3 whitespace-pre-wrap">{previewPost.caption}</p>
                </div>
              )}

              {previewPost.hashtags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {previewPost.hashtags.map((h) => (
                    <span key={h} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">#{h}</span>
                  ))}
                </div>
              )}

              <button onClick={() => setPreviewPost(null)}
                className="w-full py-2 border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
