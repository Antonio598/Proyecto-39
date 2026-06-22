"use client";

import { useState, useRef, useCallback } from "react";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { useQuery } from "@tanstack/react-query";
import {
  PenLine, Upload, X, CheckCircle, Loader2, Sparkles,
  Calendar, Send, Clock, Library, ChevronDown, ChevronUp,
  ArrowLeft, Image as ImageIcon, Video,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  FORMAT_LABELS, PLATFORM_FORMATS, PLATFORM_LABELS,
} from "@/lib/utils/platform";
import { cn } from "@/lib/utils/cn";
import type { SocialPlatform, PostFormat, SocialAccount, ContentAsset } from "@/types/database";

const TONES = [
  { value: "profesional", label: "Profesional" },
  { value: "casual", label: "Casual" },
  { value: "divertido", label: "Divertido" },
  { value: "inspirador", label: "Inspirador" },
  { value: "informativo", label: "Informativo" },
  { value: "urgente", label: "Urgente" },
];

const LANGUAGES = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
];

const ALL_FORMATS: PostFormat[] = ["image", "carousel", "reel", "story", "short", "long_video", "text"];

function parseHashtags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean);
}

export default function ManualCreatePage() {
  const { activeWorkspaceId } = useWorkspace();
  const router = useRouter();

  // Media
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format
  const [format, setFormat] = useState<PostFormat>("image");

  // Copy
  const [caption, setCaption] = useState("");
  const [hashtagsRaw, setHashtagsRaw] = useState("");

  // AI caption
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTone, setAiTone] = useState("profesional");
  const [aiLanguage, setAiLanguage] = useState("es");
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [aiPlatform, setAiPlatform] = useState<SocialPlatform>("instagram");

  // Accounts
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [facebookPageData, setFacebookPageData] = useState<Record<string, { pageId: string; pageName: string }>>({});

  // Schedule
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [publishMode, setPublishMode] = useState<"now" | "schedule">("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("12:00");
  const [submitting, setSubmitting] = useState(false);

  // Fetch accounts
  const { data: accounts = [] } = useQuery<SocialAccount[]>({
    queryKey: ["accounts", activeWorkspaceId],
    queryFn: async () => {
      const res = await fetch("/api/social-accounts", {
        headers: { "x-workspace-id": activeWorkspaceId! },
      });
      return (await res.json()).data ?? [];
    },
    enabled: !!activeWorkspaceId,
  });

  // Fetch media bank assets
  const { data: allAssets = [] } = useQuery<ContentAsset[]>({
    queryKey: ["assets-all", activeWorkspaceId],
    queryFn: async () => {
      const res = await fetch("/api/content", {
        headers: { "x-workspace-id": activeWorkspaceId! },
      });
      return (await res.json()).data ?? [];
    },
    enabled: !!activeWorkspaceId,
  });

  const activeAccounts = accounts.filter((a) => a.is_active);
  const mediaAssets = allAssets.filter((a) => a.asset_type === "photo" || a.asset_type === "video");

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "manual-posts");
      const res = await fetch("/api/content/upload", {
        method: "POST",
        headers: { "x-workspace-id": activeWorkspaceId! },
        body: fd,
      });
      if (!res.ok) throw new Error("Error al subir el archivo");
      const json = await res.json();
      setMediaUrl(json.data.publicUrl);
      setMediaType(file.type.startsWith("video/") ? "video" : "image");
      toast.success("Archivo subido correctamente");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId]);

  function selectFromBank(asset: ContentAsset) {
    setMediaUrl(asset.public_url);
    setMediaType(asset.asset_type === "video" ? "video" : "image");
    setSelectedAssetId(asset.id);
    setShowAssetPicker(false);
  }

  function clearMedia() {
    setMediaUrl(null);
    setMediaType(null);
    setSelectedAssetId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function generateCaption() {
    if (!aiPrompt.trim()) {
      toast.error("Escribe una descripción para generar el caption");
      return;
    }
    setGeneratingCaption(true);
    try {
      const res = await fetch("/api/ai/script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspaceId!,
        },
        body: JSON.stringify({
          platform: aiPlatform,
          format,
          promptText: aiPrompt,
          tone: aiTone,
          language: aiLanguage,
          useHashtags: true,
          useEmojis: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error al generar");
      }
      const json = await res.json();
      setCaption(json.data.caption);
      setHashtagsRaw(json.data.hashtags.map((h: string) => `#${h}`).join(" "));
      toast.success("Caption generado");
      setShowAiPanel(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al generar el caption");
    } finally {
      setGeneratingCaption(false);
    }
  }

  function toggleAccount(id: string) {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (selectedAccountIds.size === 0) {
      toast.error("Selecciona al menos una cuenta");
      return;
    }
    if (publishMode === "schedule" && !scheduleDate) {
      toast.error("Selecciona una fecha para programar");
      return;
    }

    setSubmitting(true);
    try {
      const scheduledAt =
        publishMode === "now"
          ? new Date().toISOString()
          : new Date(`${scheduleDate}T${scheduleTime}`).toISOString();

      const res = await fetch("/api/posts/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspaceId!,
        },
        body: JSON.stringify({
          mediaUrl: mediaUrl ?? undefined,
          format,
          caption,
          hashtags: parseHashtags(hashtagsRaw),
          accountIds: Array.from(selectedAccountIds),
          scheduledAt,
          publishMode: publishMode === "now" ? "auto" : "approval",
          facebookPageData,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error al crear el post");
      }

      const json = await res.json();
      const { scheduledPosts } = json.data as {
        generatedPostId: string;
        scheduledPosts: { id: string; social_account_id: string }[];
      };

      if (publishMode === "now") {
        await Promise.all(
          scheduledPosts.map((sp) =>
            fetch(`/api/posts/${sp.id}/publish`, {
              method: "POST",
              headers: { "x-workspace-id": activeWorkspaceId! },
            })
          )
        );
        toast.success(`Publicado en ${scheduledPosts.length} cuenta${scheduledPosts.length > 1 ? "s" : ""}`);
      } else {
        toast.success(`Programado para ${scheduleDate} a las ${scheduleTime}`);
      }

      setShowScheduleModal(false);
      router.push("/calendar");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al publicar");
    } finally {
      setSubmitting(false);
    }
  }

  const facebookAccounts = activeAccounts.filter(
    (a) => a.platform === "facebook" && selectedAccountIds.has(a.id)
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/create" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
          <PenLine className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Crear manualmente</h1>
          <p className="text-muted-foreground text-xs">Sube tu contenido y redacta el copy</p>
        </div>
      </div>

      {/* Section A — Media */}
      <div className="bg-white rounded-2xl border p-5 space-y-4">
        <h2 className="font-semibold text-sm">1. Contenido multimedia</h2>

        {/* Format selector */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">Formato</label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={cn(
                  "text-xs px-3 py-1 rounded-full border transition-all",
                  format === f
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "border-border text-muted-foreground hover:border-indigo-300 hover:text-indigo-600"
                )}
              >
                {FORMAT_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Upload zone */}
        {!mediaUrl ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
              isDragging ? "border-indigo-400 bg-indigo-50" : "border-border hover:border-indigo-300 hover:bg-indigo-50/30"
            )}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-sm text-muted-foreground">Subiendo archivo…</p>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-medium mb-1">Arrastra tu archivo aquí</p>
                <p className="text-xs text-muted-foreground mb-3">Imagen o video · Máx. 500 MB</p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Seleccionar archivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAssetPicker(true)}
                    className="text-xs border px-4 py-1.5 rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5"
                  >
                    <Library className="w-3.5 h-3.5" /> Banco multimedia
                  </button>
                </div>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden bg-muted">
            {mediaType === "video" ? (
              <video src={mediaUrl} controls className="w-full max-h-64 object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl} alt="Preview" className="w-full max-h-64 object-contain" />
            )}
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
              {mediaType === "video" ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
              {mediaType === "video" ? "Video" : "Imagen"}
            </div>
            <button
              type="button"
              onClick={clearMedia}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {format === "text" && (
          <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
            El formato "Texto" no requiere archivo multimedia.
          </p>
        )}
      </div>

      {/* Section B — Copy */}
      <div className="bg-white rounded-2xl border p-5 space-y-4">
        <h2 className="font-semibold text-sm">2. Copy</h2>

        {/* Caption */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-muted-foreground">Caption</label>
            <span className="text-xs text-muted-foreground">{caption.length} caracteres</span>
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Escribe el texto de tu publicación…"
            rows={4}
            className="w-full border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Hashtags */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Hashtags <span className="font-normal">(separados por espacio o coma)</span>
          </label>
          <input
            type="text"
            value={hashtagsRaw}
            onChange={(e) => setHashtagsRaw(e.target.value)}
            placeholder="#marketing #socialmedia #contenido"
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {hashtagsRaw && (
            <div className="flex flex-wrap gap-1 mt-2">
              {parseHashtags(hashtagsRaw).map((tag) => (
                <span key={tag} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* AI panel */}
        <div className="border rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAiPanel((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              Generar caption con IA
            </div>
            {showAiPanel ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {showAiPanel && (
            <div className="border-t px-4 pb-4 pt-3 space-y-3 bg-indigo-50/30">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Describe tu publicación *
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Ej: Lanzamiento de nuevo producto de café orgánico, destacar beneficios para la salud y el origen natural…"
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Plataforma</label>
                  <select
                    value={aiPlatform}
                    onChange={(e) => setAiPlatform(e.target.value as SocialPlatform)}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {(Object.keys(PLATFORM_LABELS) as SocialPlatform[]).map((p) => (
                      <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Tono</label>
                  <select
                    value={aiTone}
                    onChange={(e) => setAiTone(e.target.value)}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {TONES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Idioma</label>
                  <select
                    value={aiLanguage}
                    onChange={(e) => setAiLanguage(e.target.value)}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={generateCaption}
                disabled={generatingCaption || !aiPrompt.trim()}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {generatingCaption ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generando…</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Generar caption</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Section C — Publish */}
      <div className="bg-white rounded-2xl border p-5 space-y-4">
        <h2 className="font-semibold text-sm">3. Publicar en</h2>

        {activeAccounts.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">No tienes cuentas conectadas.</p>
            <Link href="/accounts" className="text-xs text-indigo-600 hover:underline mt-1 inline-block">
              Conectar cuentas →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {activeAccounts.map((account) => {
              const checked = selectedAccountIds.has(account.id);
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => toggleAccount(account.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-left",
                    checked
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-border hover:border-indigo-200 hover:bg-muted/30"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                    checked ? "border-indigo-500 bg-indigo-500" : "border-border"
                  )}>
                    {checked && <CheckCircle className="w-3.5 h-3.5 text-white fill-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{account.account_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{account.platform}</p>
                  </div>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    PLATFORM_FORMATS[account.platform]?.includes(format)
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  )}>
                    {PLATFORM_FORMATS[account.platform]?.includes(format)
                      ? FORMAT_LABELS[format]
                      : "Formato no soportado"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Facebook page selectors */}
        {facebookAccounts.map((account) => {
          const meta = account.metadata as Record<string, unknown> | null;
          const pages = Array.isArray(meta?.facebook_pages)
            ? (meta.facebook_pages as { id: string; name: string }[])
            : [];
          if (pages.length === 0) return null;
          return (
            <div key={account.id}>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Página de Facebook — {account.account_name}
              </label>
              <select
                value={facebookPageData[account.id]?.pageId ?? ""}
                onChange={(e) => {
                  const page = pages.find((p) => p.id === e.target.value);
                  if (page) {
                    setFacebookPageData((prev) => ({
                      ...prev,
                      [account.id]: { pageId: page.id, pageName: page.name },
                    }));
                  }
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecciona una página…</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          );
        })}

        {/* CTA */}
        <button
          type="button"
          onClick={() => setShowScheduleModal(true)}
          disabled={selectedAccountIds.size === 0}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          <Calendar className="w-4 h-4" />
          Publicar / Programar
        </button>
      </div>

      {/* Schedule modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Publicar contenido</h3>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              {selectedAccountIds.size} cuenta{selectedAccountIds.size > 1 ? "s" : ""} seleccionada{selectedAccountIds.size > 1 ? "s" : ""}
            </p>

            {/* Publish now */}
            <button
              type="button"
              onClick={() => { setPublishMode("now"); submit(); }}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {submitting && publishMode === "now" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Publicar ahora
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">o programar para</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Fecha</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Hora</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => { setPublishMode("schedule"); submit(); }}
              disabled={submitting || !scheduleDate}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {submitting && publishMode === "schedule" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              Programar publicación
            </button>
          </div>
        </div>
      )}

      {/* Asset picker modal */}
      {showAssetPicker && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowAssetPicker(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <Library className="w-4 h-4 text-indigo-600" />
                <h3 className="font-semibold text-sm">Banco multimedia ({mediaAssets.length})</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAssetPicker(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {mediaAssets.length === 0 ? (
                <div className="text-center py-12">
                  <Library className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm font-medium">No hay archivos en el banco</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ve a{" "}
                    <span className="text-indigo-600 font-medium">Contenido → Banco multimedia</span>
                    {" "}para subir archivos
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {mediaAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => selectFromBank(asset)}
                      className={cn(
                        "group relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105",
                        selectedAssetId === asset.id
                          ? "border-indigo-500 shadow-lg ring-2 ring-indigo-200"
                          : "border-transparent hover:border-indigo-300"
                      )}
                    >
                      {asset.asset_type === "video" ? (
                        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                          <Video className="w-8 h-8 text-white/60" />
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={asset.public_url} alt={asset.file_name} className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded-lg">Seleccionar</span>
                      </div>
                      {selectedAssetId === asset.id && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
