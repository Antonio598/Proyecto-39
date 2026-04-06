"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles, Loader2, CheckCircle, AlertCircle, ArrowLeft,
  ImageIcon, Video, FileText, ChevronRight, Library,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PLATFORM_LABELS, FORMAT_LABELS, PLATFORM_FORMATS } from "@/lib/utils/platform";
import { cn } from "@/lib/utils/cn";
import type { SocialPlatform, PostFormat, SocialAccount, ContentAsset } from "@/types/database";

const TONES = ["profesional", "casual", "divertido", "inspirador", "informativo", "urgente"];
const LANGUAGES = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
];

const VIDEO_FORMATS: PostFormat[] = ["reel", "short", "long_video"];
const IMAGE_FORMATS: PostFormat[] = ["image", "carousel", "story"];

type PipelineStep = "copy" | "image" | "video";
type StepStatus = "pending" | "running" | "done" | "skipped" | "error";

interface PipelineState {
  copy: StepStatus;
  image: StepStatus;
  video: StepStatus;
}

interface GenerationResult {
  caption?: string;
  hashtags?: string[];
  imageUrl?: string;
  videoUrl?: string;
  postId?: string;
}

export default function AiCreatePage() {
  const { activeWorkspaceId } = useWorkspace();

  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [format, setFormat] = useState<PostFormat>("reel");
  const [accountId, setAccountId] = useState("");
  const [promptText, setPromptText] = useState("");
  const [tone, setTone] = useState("profesional");
  const [language, setLanguage] = useState("es");
  const [useHashtags, setUseHashtags] = useState(true);
  const [useEmojis, setUseEmojis] = useState(true);

  // Pipeline options
  const [skipImage, setSkipImage] = useState(false);
  const [skipVideo, setSkipVideo] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [showAssetPicker, setShowAssetPicker] = useState(false);

  // Generation state
  const [running, setRunning] = useState(false);
  const [pipelineState, setPipelineState] = useState<PipelineState>({ copy: "pending", image: "pending", video: "pending" });
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isVideo = VIDEO_FORMATS.includes(format);
  const isImage = IMAGE_FORMATS.includes(format);

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

  // Fetch media bank assets (photos/videos)
  const { data: assets = [] } = useQuery<ContentAsset[]>({
    queryKey: ["assets", activeWorkspaceId, "photo"],
    queryFn: async () => {
      const res = await fetch("/api/content?type=photo", {
        headers: { "x-workspace-id": activeWorkspaceId! },
      });
      return (await res.json()).data ?? [];
    },
    enabled: !!activeWorkspaceId,
  });

  const filteredAccounts = accounts.filter((a) => a.platform === platform && a.is_active);
  const availableFormats = PLATFORM_FORMATS[platform] ?? [];

  useEffect(() => {
    if (!availableFormats.includes(format)) {
      setFormat(availableFormats[0]);
    }
    setAccountId("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  function updateStep(step: PipelineStep, status: StepStatus) {
    setPipelineState((prev) => ({ ...prev, [step]: status }));
  }

  async function pollJob(jobId: string): Promise<{ status: string; result?: { caption?: string; hashtags?: string[]; mediaUrls?: string[] } }> {
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const res = await fetch(`/api/ai/status/${jobId}`, {
        headers: { "x-workspace-id": activeWorkspaceId! },
      });
      const json = await res.json();
      if (json.data?.status === "completed" || json.data?.status === "failed") {
        return json.data;
      }
    }
    return { status: "failed" };
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspaceId || !promptText.trim()) return;

    setRunning(true);
    setResult(null);
    setError(null);
    setPipelineState({ copy: "pending", image: "pending", video: "pending" });

    const finalResult: GenerationResult = {};

    try {
      // ── STEP 1: COPY ─────────────────────────────────────────────
      updateStep("copy", "running");

      const copyRes = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-workspace-id": activeWorkspaceId },
        body: JSON.stringify({ format: "text", platform, promptText, tone, language, useHashtags, useEmojis }),
      });
      const copyJson = await copyRes.json();

      if (!copyRes.ok) throw new Error(copyJson.error ?? "Error al generar el copy");

      const copyPoll = await pollJob(copyJson.data.jobId);
      if (copyPoll.status === "failed") throw new Error("Error generando el copy");

      finalResult.caption = copyPoll.result?.caption;
      finalResult.hashtags = copyPoll.result?.hashtags;
      finalResult.postId = copyJson.data.postId;
      updateStep("copy", "done");

      // ── STEP 2: IMAGE ────────────────────────────────────────────
      if (isImage || isVideo) {
        if (selectedAssetId && selectedAsset) {
          // Use existing asset from media bank
          finalResult.imageUrl = selectedAsset.public_url;
          updateStep("image", "skipped");
        } else if (!skipImage) {
          updateStep("image", "running");

          const imgFormat = isVideo ? "image" : format;
          const imgRes = await fetch("/api/ai/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-workspace-id": activeWorkspaceId },
            body: JSON.stringify({
              format: imgFormat,
              platform,
              promptText: `${promptText}. ${finalResult.caption ?? ""}`,
              tone,
              language,
            }),
          });
          const imgJson = await imgRes.json();

          if (imgRes.ok) {
            const imgPoll = await pollJob(imgJson.data.jobId);
            if (imgPoll.status === "completed") {
              finalResult.imageUrl = imgPoll.result?.mediaUrls?.[0];
              updateStep("image", "done");
            } else {
              updateStep("image", "error");
            }
          } else {
            updateStep("image", "error");
          }
        } else {
          updateStep("image", "skipped");
        }
      } else {
        updateStep("image", "skipped");
      }

      // ── STEP 3: VIDEO ────────────────────────────────────────────
      if (isVideo && !skipVideo) {
        updateStep("video", "running");

        const videoRes = await fetch("/api/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-workspace-id": activeWorkspaceId },
          body: JSON.stringify({
            format,
            platform,
            promptText: finalResult.imageUrl
              ? `${promptText}. ${finalResult.caption ?? ""}. Reference image: ${finalResult.imageUrl}`
              : `${promptText}. ${finalResult.caption ?? ""}`,
            tone,
            language,
            referenceImageUrl: finalResult.imageUrl,
          }),
        });
        const videoJson = await videoRes.json();

        if (videoRes.ok) {
          const videoPoll = await pollJob(videoJson.data.jobId);
          if (videoPoll.status === "completed") {
            finalResult.videoUrl = videoPoll.result?.mediaUrls?.[0];
            updateStep("video", "done");
          } else {
            updateStep("video", "error");
          }
        } else {
          updateStep("video", "error");
        }
      } else if (isVideo) {
        updateStep("video", "skipped");
      } else {
        updateStep("video", "skipped");
      }

      setResult(finalResult);
      toast.success("¡Contenido generado correctamente!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(msg);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  }

  const stepLabels: Record<PipelineStep, string> = {
    copy: "Generando copy y hashtags",
    image: "Generando imagen",
    video: "Generando video",
  };

  const stepIcons: Record<PipelineStep, React.ReactNode> = {
    copy: <FileText className="w-4 h-4" />,
    image: <ImageIcon className="w-4 h-4" />,
    video: <Video className="w-4 h-4" />,
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/create" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-indigo-600" />
          Generar contenido con IA
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          La IA genera el copy, luego la imagen y finalmente el video de forma automática
        </p>
      </div>

      <form onSubmit={handleGenerate} className="space-y-5">
        {/* Platform + Format */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h3 className="font-semibold text-sm">Red social y formato</h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {(["instagram", "facebook", "youtube", "linkedin", "tiktok"] as SocialPlatform[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                  platform === p
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-border hover:border-indigo-200"
                }`}
              >
                {PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {availableFormats.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  format === f
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-border hover:border-indigo-200"
                }`}
              >
                {FORMAT_LABELS[f]}
              </button>
            ))}
          </div>

          {filteredAccounts.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Cuenta de destino (opcional)
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Sin asignar</option>
                {filteredAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Prompt */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h3 className="font-semibold text-sm">Descripción del contenido</h3>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            required
            rows={4}
            placeholder={`Ej: Un ${FORMAT_LABELS[format]} sobre los beneficios del yoga matutino, con un ambiente tranquilo y colores suaves...`}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Tono</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {TONES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Idioma</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={useHashtags} onChange={(e) => setUseHashtags(e.target.checked)} className="rounded" />
                <span className="text-xs">Hashtags</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={useEmojis} onChange={(e) => setUseEmojis(e.target.checked)} className="rounded" />
                <span className="text-xs">Emojis</span>
              </label>
            </div>
          </div>
        </div>

        {/* Pipeline options */}
        {(isImage || isVideo) && (
          <div className="bg-white rounded-xl border p-5 space-y-4">
            <h3 className="font-semibold text-sm">Opciones de pipeline</h3>

            {/* Asset picker */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Usar imagen del banco multimedia (en lugar de generar una)
                </label>
                <button
                  type="button"
                  onClick={() => setShowAssetPicker((v) => !v)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                >
                  <Library className="w-3.5 h-3.5" />
                  {showAssetPicker ? "Cerrar" : "Seleccionar del banco"}
                </button>
              </div>

              {selectedAsset && (
                <div className="flex items-center gap-3 p-2 bg-indigo-50 rounded-lg border border-indigo-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedAsset.public_url} alt="" className="w-10 h-10 object-cover rounded-md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{selectedAsset.file_name}</p>
                    <p className="text-xs text-muted-foreground">Del banco multimedia</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedAssetId(null); setShowAssetPicker(false); }}
                    className="text-xs text-muted-foreground hover:text-red-500"
                  >
                    Quitar
                  </button>
                </div>
              )}

              {showAssetPicker && (
                <div className="mt-2 border rounded-lg p-3 max-h-48 overflow-y-auto">
                  {assets.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No hay fotos en el banco.{" "}
                      <Link href="/content" className="text-indigo-600 hover:underline">Subir fotos</Link>
                    </p>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {assets.map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => { setSelectedAssetId(asset.id); setShowAssetPicker(false); }}
                          className={cn(
                            "aspect-square rounded-lg overflow-hidden border-2 transition-colors",
                            selectedAssetId === asset.id ? "border-indigo-500" : "border-transparent hover:border-indigo-300"
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={asset.public_url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Skip options */}
            {!selectedAssetId && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipImage}
                  onChange={(e) => setSkipImage(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Omitir generación de imagen (solo copy)</span>
              </label>
            )}

            {isVideo && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipVideo}
                  onChange={(e) => setSkipVideo(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Omitir generación de video (solo imagen + copy)</span>
              </label>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={running || !promptText.trim()}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {running ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Procesando pipeline...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Generar contenido</>
          )}
        </button>
      </form>

      {/* Pipeline progress */}
      {running && (
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-sm mb-4">Pipeline de generación</h3>
          <div className="space-y-3">
            {(["copy", "image", "video"] as PipelineStep[]).map((step, i) => {
              const status = pipelineState[step];
              return (
                <div key={step} className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                    status === "running" ? "bg-indigo-100 text-indigo-600 animate-pulse" :
                    status === "done" ? "bg-emerald-100 text-emerald-600" :
                    status === "error" ? "bg-red-100 text-red-600" :
                    status === "skipped" ? "bg-gray-100 text-gray-400" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {status === "running" ? <Loader2 className="w-4 h-4 animate-spin" /> :
                     status === "done" ? <CheckCircle className="w-4 h-4" /> :
                     stepIcons[step]}
                  </div>
                  <div className="flex-1">
                    <p className={cn(
                      "text-sm font-medium",
                      status === "running" ? "text-indigo-700" :
                      status === "done" ? "text-emerald-700" :
                      status === "error" ? "text-red-600" :
                      "text-muted-foreground"
                    )}>
                      {stepLabels[step]}
                    </p>
                  </div>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    status === "running" ? "bg-indigo-50 text-indigo-700" :
                    status === "done" ? "bg-emerald-50 text-emerald-700" :
                    status === "error" ? "bg-red-50 text-red-700" :
                    status === "skipped" ? "bg-gray-100 text-gray-500" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {status === "running" ? "En proceso" :
                     status === "done" ? "Listo" :
                     status === "error" ? "Error" :
                     status === "skipped" ? "Omitido" :
                     "Pendiente"}
                  </span>
                  {i < 2 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Result */}
      {!running && result && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle className="w-5 h-5" />
            <h3 className="font-semibold">Contenido generado</h3>
          </div>

          {result.videoUrl && (
            <div className="rounded-lg overflow-hidden bg-muted">
              <video src={result.videoUrl} controls className="w-full max-h-80 object-contain" />
            </div>
          )}

          {!result.videoUrl && result.imageUrl && (
            <div className="rounded-lg overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.imageUrl} alt="Imagen generada" className="w-full max-h-80 object-contain" />
            </div>
          )}

          {result.caption && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Caption</label>
              <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap">{result.caption}</div>
            </div>
          )}

          {result.hashtags && result.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.hashtags.map((tag) => (
                <span key={tag} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Link
              href={`/calendar?postId=${result.postId}`}
              className="flex-1 text-center bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Programar publicación
            </Link>
            <button
              type="button"
              onClick={() => { setResult(null); setPipelineState({ copy: "pending", image: "pending", video: "pending" }); }}
              className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              Generar otro
            </button>
          </div>
        </div>
      )}

      {!running && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">Error al generar el contenido</p>
            <p className="text-xs text-red-600 mt-0.5">
              {error.includes("key") || error.includes("Key")
                ? "Verifica que las API keys estén configuradas en "
                : error}
              {(error.includes("key") || error.includes("Key")) && (
                <Link href="/workspace/integrations" className="underline">Integraciones de IA</Link>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
