"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles, Loader2, CheckCircle, AlertCircle, ArrowLeft,
  Library, Copy, RefreshCw, KeyRound,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PLATFORM_LABELS, FORMAT_LABELS, PLATFORM_FORMATS } from "@/lib/utils/platform";
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

const VIDEO_FORMATS: PostFormat[] = ["reel", "short", "long_video"];
const IMAGE_FORMATS: PostFormat[] = ["image", "carousel", "story"];

// ── Types ──────────────────────────────────────────────────────────────────

type StepId = "script" | "image" | "video";
type StepStatus = "pending" | "running" | "done" | "skipped" | "error";

interface PipelineStep {
  id: StepId;
  label: string;
  sublabel: string;
  emoji: string;
}

interface ScriptData {
  postId: string;
  caption: string;
  hashtags: string[];
  imagePrompt: string;
  videoPrompt: string;
}

interface FinalResult {
  postId: string;
  caption: string;
  hashtags: string[];
  imageUrl?: string;
  videoUrl?: string;
}

const PIPELINE_STEPS: PipelineStep[] = [
  { id: "script", label: "Guión y copy", sublabel: "GPT-4o mini", emoji: "🤖" },
  { id: "image", label: "Imagen", sublabel: "Nano Banana", emoji: "🍌" },
  { id: "video", label: "Video", sublabel: "Kling AI", emoji: "🎬" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

async function pollJobUntilDone(
  jobId: string,
  workspaceId: string,
  maxSeconds = 600,
  onTick?: (elapsed: number) => void,
): Promise<{ mediaUrls?: string[]; caption?: string; hashtags?: string[] } | null> {
  const interval = 5000; // 5 seconds between polls
  const maxAttempts = Math.floor((maxSeconds * 1000) / interval);
  let elapsed = 0;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, interval));
    elapsed += Math.floor(interval / 1000);
    onTick?.(elapsed);
    const res = await fetch(`/api/ai/status/${jobId}`, {
      headers: { "x-workspace-id": workspaceId },
    });
    if (!res.ok) continue;
    const json = await res.json();
    const data = json.data;
    if (data?.status === "completed") return data.result ?? null;
    if (data?.status === "failed") return null;
  }
  return null;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AiCreatePage() {
  const { activeWorkspaceId } = useWorkspace();

  // Form state
  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [format, setFormat] = useState<PostFormat>("reel");
  const [promptText, setPromptText] = useState("");
  const [tone, setTone] = useState("profesional");
  const [language, setLanguage] = useState("es");
  const [useHashtags, setUseHashtags] = useState(true);
  const [useEmojis, setUseEmojis] = useState(true);

  // Media bank picker
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [showAssetPicker, setShowAssetPicker] = useState(false);

  // Options
  const [skipImage, setSkipImage] = useState(false);
  const [skipVideo, setSkipVideo] = useState(false);

  // Pipeline state
  const [running, setRunning] = useState(false);
  const [stepStatus, setStepStatus] = useState<Record<StepId, StepStatus>>({
    script: "pending", image: "pending", video: "pending",
  });
  const [stepError, setStepError] = useState<Partial<Record<StepId, string>>>({});
  const [stepElapsed, setStepElapsed] = useState<Partial<Record<StepId, number>>>({});

  // Intermediate results (shown progressively)
  const [scriptData, setScriptData] = useState<ScriptData | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<FinalResult | null>(null);

  const isVideo = VIDEO_FORMATS.includes(format);
  const isImage = IMAGE_FORMATS.includes(format);
  const availableFormats = PLATFORM_FORMATS[platform] ?? [];

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

  // Fetch media bank photos
  const { data: photoAssets = [] } = useQuery<ContentAsset[]>({
    queryKey: ["assets-photos", activeWorkspaceId],
    queryFn: async () => {
      const res = await fetch("/api/content?type=photo", {
        headers: { "x-workspace-id": activeWorkspaceId! },
      });
      return (await res.json()).data ?? [];
    },
    enabled: !!activeWorkspaceId,
  });

  useEffect(() => {
    if (!availableFormats.includes(format)) {
      setFormat(availableFormats[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  const selectedAsset = photoAssets.find((a) => a.id === selectedAssetId);
  const filteredAccounts = accounts.filter((a) => a.platform === platform && a.is_active);

  function setStep(id: StepId, status: StepStatus, errMsg?: string) {
    setStepStatus((prev) => ({ ...prev, [id]: status }));
    if (errMsg) setStepError((prev) => ({ ...prev, [id]: errMsg }));
  }

  function resetPipeline() {
    setRunning(false);
    setStepStatus({ script: "pending", image: "pending", video: "pending" });
    setStepError({});
    setStepElapsed({});
    setScriptData(null);
    setGeneratedImageUrl(null);
    setFinalResult(null);
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspaceId || !promptText.trim()) return;

    resetPipeline();
    setRunning(true);

    try {
      // ═══════════════════════════════════════════════════════
      // STEP 1 — Script / Copy via OpenAI
      // ═══════════════════════════════════════════════════════
      setStep("script", "running");

      const scriptRes = await fetch("/api/ai/script", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-workspace-id": activeWorkspaceId },
        body: JSON.stringify({ platform, format, promptText, tone, language, useHashtags, useEmojis }),
      });

      const scriptJson = await scriptRes.json();

      if (!scriptRes.ok) {
        const msg = scriptJson.error ?? "Error al generar el guión";
        setStep("script", "error", msg);
        // skip remaining steps
        setStep("image", "skipped");
        setStep("video", "skipped");
        toast.error(msg);
        setRunning(false);
        return;
      }

      const script: ScriptData = scriptJson.data;
      setScriptData(script);
      setStep("script", "done");
      toast.success("Guión generado ✓");

      // ═══════════════════════════════════════════════════════
      // STEP 2 — Image generation (Nano Banana) or bank asset
      // ═══════════════════════════════════════════════════════
      let imageUrl: string | null = null;

      if (isImage || isVideo) {
        if (selectedAsset) {
          // Use existing bank photo
          imageUrl = selectedAsset.public_url;
          setGeneratedImageUrl(imageUrl);
          setStep("image", "skipped");
        } else if (!skipImage) {
          setStep("image", "running");

          const imgRes = await fetch("/api/ai/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-workspace-id": activeWorkspaceId },
            body: JSON.stringify({
              format: isVideo ? "image" : format,
              platform,
              promptText: script.imagePrompt,
              tone,
              language,
              postId: script.postId,
            }),
          });

          const imgJson = await imgRes.json();

          if (!imgRes.ok) {
            setStep("image", "error", imgJson.error ?? "Error al generar imagen");
          } else {
            const imgResult = await pollJobUntilDone(
              imgJson.data.jobId,
              activeWorkspaceId,
              600,
              (s) => setStepElapsed((p) => ({ ...p, image: s })),
            );
            if (imgResult?.mediaUrls?.[0]) {
              imageUrl = imgResult.mediaUrls[0];
              setGeneratedImageUrl(imageUrl);
              setStep("image", "done");
              toast.success("Imagen generada ✓");
            } else {
              setStep("image", "error", "Nano Banana no respondió (revisa tu API key en Integraciones)");
            }
          }
        } else {
          setStep("image", "skipped");
        }
      } else {
        setStep("image", "skipped");
      }

      // ═══════════════════════════════════════════════════════
      // STEP 3 — Video generation (Kling)
      // ═══════════════════════════════════════════════════════
      let videoUrl: string | null = null;

      if (isVideo && !skipVideo) {
        setStep("video", "running");

        const videoRes = await fetch("/api/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-workspace-id": activeWorkspaceId },
          body: JSON.stringify({
            format,
            platform,
            promptText: script.videoPrompt,
            tone,
            language,
            referenceImageUrl: imageUrl ?? undefined,
            postId: script.postId,
          }),
        });

        const videoJson = await videoRes.json();

        if (!videoRes.ok) {
          setStep("video", "error", videoJson.error ?? "Error al generar video");
        } else {
          const videoResult = await pollJobUntilDone(
            videoJson.data.jobId,
            activeWorkspaceId,
            900,
            (s) => setStepElapsed((p) => ({ ...p, video: s })),
          );
          if (videoResult?.mediaUrls?.[0]) {
            videoUrl = videoResult.mediaUrls[0];
            setStep("video", "done");
            toast.success("Video generado ✓");
          } else {
            setStep("video", "error", "Kling no respondió (revisa tu API key en Integraciones)");
          }
        }
      } else if (isVideo && skipVideo) {
        setStep("video", "skipped");
      } else {
        setStep("video", "skipped");
      }

      // ═══════════════════════════════════════════════════════
      // Done — show final result
      // ═══════════════════════════════════════════════════════
      setFinalResult({
        postId: script.postId,
        caption: script.caption,
        hashtags: script.hashtags,
        imageUrl: imageUrl ?? undefined,
        videoUrl: videoUrl ?? undefined,
      });

      toast.success("¡Pipeline completado!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setRunning(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/create" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-indigo-600" />
          Crear contenido con IA
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Describe tu idea → GPT genera el guión → Nano Banana crea la imagen → Kling hace el video
        </p>
      </div>

      {/* Form */}
      {!running && !finalResult && (
        <form onSubmit={handleGenerate} className="space-y-5">
          {/* Platform + Format */}
          <div className="bg-white rounded-xl border p-5 space-y-4">
            <h3 className="font-semibold text-sm">Red social y formato</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {(["instagram", "facebook", "youtube", "linkedin", "tiktok"] as SocialPlatform[]).map((p) => (
                <button key={p} type="button" onClick={() => setPlatform(p)}
                  className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                    platform === p ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-border hover:border-indigo-200"
                  }`}>
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {availableFormats.map((f) => (
                <button key={f} type="button" onClick={() => setFormat(f)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    format === f ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-border hover:border-indigo-200"
                  }`}>
                  {FORMAT_LABELS[f]}
                </button>
              ))}
            </div>
            {filteredAccounts.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Cuenta de destino (opcional)</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
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
            <h3 className="font-semibold text-sm">Describe tu idea de contenido</h3>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              required
              rows={4}
              placeholder={`Ej: Un ${FORMAT_LABELS[format]} sobre cómo preparar el café perfecto en casa. Mostrar el proceso paso a paso, ambiente de cocina cálida y acogedora, colores tierra...`}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Tono de voz</label>
                <select value={tone} onChange={(e) => setTone(e.target.value)}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Idioma</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input type="checkbox" checked={useHashtags} onChange={(e) => setUseHashtags(e.target.checked)} className="rounded" />
                  Hashtags
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input type="checkbox" checked={useEmojis} onChange={(e) => setUseEmojis(e.target.checked)} className="rounded" />
                  Emojis
                </label>
              </div>
            </div>
          </div>

          {/* Media bank picker + pipeline options */}
          {(isImage || isVideo) && (
            <div className="bg-white rounded-xl border p-5 space-y-4">
              <h3 className="font-semibold text-sm">Opciones de imagen y video</h3>

              {/* Media bank picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground font-medium">
                    {selectedAsset ? "Imagen seleccionada del banco:" : "¿Usar imagen existente del banco multimedia?"}
                  </p>
                  <button type="button" onClick={() => setShowAssetPicker((v) => !v)}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                    <Library className="w-3.5 h-3.5" />
                    {showAssetPicker ? "Cerrar banco" : "Abrir banco"}
                  </button>
                </div>

                {selectedAsset && (
                  <div className="flex items-center gap-3 p-2 bg-indigo-50 rounded-lg border border-indigo-200 mb-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedAsset.public_url} alt="" className="w-12 h-12 object-cover rounded-md flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{selectedAsset.file_name}</p>
                      <p className="text-xs text-indigo-600">Se usará esta imagen (no se generará una nueva)</p>
                    </div>
                    <button type="button" onClick={() => { setSelectedAssetId(null); }}
                      className="text-xs text-red-500 hover:text-red-700 font-medium">Quitar</button>
                  </div>
                )}

                {showAssetPicker && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                      Banco multimedia — fotos ({photoAssets.length})
                    </div>
                    <div className="p-3 max-h-52 overflow-y-auto">
                      {photoAssets.length === 0 ? (
                        <div className="text-center py-6">
                          <p className="text-xs text-muted-foreground">No hay fotos en el banco.</p>
                          <Link href="/content" className="text-xs text-indigo-600 hover:underline">
                            Subir fotos →
                          </Link>
                        </div>
                      ) : (
                        <div className="grid grid-cols-5 gap-2">
                          {photoAssets.map((asset) => (
                            <button key={asset.id} type="button"
                              onClick={() => { setSelectedAssetId(asset.id); setShowAssetPicker(false); }}
                              className={cn(
                                "aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105",
                                selectedAssetId === asset.id ? "border-indigo-500 shadow-md" : "border-transparent hover:border-indigo-300"
                              )}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={asset.public_url} alt="" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Skip options */}
              {!selectedAssetId && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={skipImage} onChange={(e) => setSkipImage(e.target.checked)} className="rounded" />
                  <span className="text-sm text-muted-foreground">Omitir generación de imagen (solo guión y copy)</span>
                </label>
              )}
              {isVideo && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={skipVideo} onChange={(e) => setSkipVideo(e.target.checked)} className="rounded" />
                  <span className="text-sm text-muted-foreground">Omitir generación de video (solo guión + imagen)</span>
                </label>
              )}
            </div>
          )}

          <button type="submit" disabled={!promptText.trim()}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            <Sparkles className="w-4 h-4" />
            Iniciar pipeline de creación
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Asegúrate de tener configuradas las API keys en{" "}
            <Link href="/workspace/integrations" className="text-indigo-600 hover:underline inline-flex items-center gap-0.5">
              <KeyRound className="w-3 h-3" />Integraciones
            </Link>
          </p>
        </form>
      )}

      {/* ─── PIPELINE RUNNING ─────────────────────────────────────────── */}
      {(running || finalResult) && (
        <div className="space-y-4">
          {/* Step tracker */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-sm mb-4">Pipeline de creación</h3>
            <div className="space-y-3">
              {PIPELINE_STEPS.map((step, i) => {
                const status = stepStatus[step.id];
                const errMsg = stepError[step.id];
                return (
                  <div key={step.id}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-base transition-all",
                        status === "running" ? "bg-indigo-100 animate-pulse" :
                        status === "done" ? "bg-emerald-100" :
                        status === "error" ? "bg-red-100" :
                        status === "skipped" ? "bg-gray-100" : "bg-muted"
                      )}>
                        {status === "running" ? <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" /> :
                         status === "done" ? <CheckCircle className="w-4 h-4 text-emerald-600" /> :
                         status === "error" ? <AlertCircle className="w-4 h-4 text-red-500" /> :
                         step.emoji}
                      </div>
                      <div className="flex-1">
                        <p className={cn(
                          "text-sm font-medium",
                          status === "running" ? "text-indigo-700" :
                          status === "done" ? "text-emerald-700" :
                          status === "error" ? "text-red-600" :
                          "text-muted-foreground"
                        )}>
                          {step.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{step.sublabel}</p>
                      </div>
                      <span className={cn(
                        "text-xs px-2.5 py-0.5 rounded-full font-medium",
                        status === "running" ? "bg-indigo-50 text-indigo-700" :
                        status === "done" ? "bg-emerald-50 text-emerald-700" :
                        status === "error" ? "bg-red-50 text-red-700" :
                        status === "skipped" ? "bg-gray-100 text-gray-500" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {status === "running"
                          ? stepElapsed[step.id]
                            ? `⏳ ${formatElapsed(stepElapsed[step.id]!)}`
                            : "Iniciando..."
                          : status === "done" ? "✓ Listo"
                          : status === "error" ? "Error"
                          : status === "skipped" ? "Omitido" : "Pendiente"}
                      </span>
                    </div>
                    {status === "running" && (
                      <p className="text-xs text-muted-foreground mt-1 ml-12">
                        {step.id === "image"
                          ? "La generación de imágenes puede tardar 2–5 minutos, por favor espera…"
                          : step.id === "video"
                          ? "La generación de video puede tardar 5–15 minutos, por favor espera…"
                          : "Procesando…"}
                      </p>
                    )}
                    {errMsg && (
                      <p className="text-xs text-red-600 mt-1 ml-12">{errMsg}</p>
                    )}
                    {/* Show caption preview right after script is done */}
                    {step.id === "script" && status === "done" && scriptData && (
                      <div className="mt-2 ml-12 bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                        <p className="text-xs font-medium text-emerald-700 mb-1">Caption generado:</p>
                        <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-3">{scriptData.caption}</p>
                        {scriptData.hashtags.length > 0 && (
                          <p className="text-xs text-indigo-600 mt-1 truncate">
                            #{scriptData.hashtags.slice(0, 5).join(" #")}
                            {scriptData.hashtags.length > 5 && ` +${scriptData.hashtags.length - 5} más`}
                          </p>
                        )}
                      </div>
                    )}
                    {/* Show image preview when done */}
                    {step.id === "image" && status === "done" && generatedImageUrl && (
                      <div className="mt-2 ml-12">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={generatedImageUrl} alt="Imagen generada"
                          className="rounded-lg max-h-40 object-contain border" />
                      </div>
                    )}
                    {i < PIPELINE_STEPS.length - 1 && (
                      <div className="ml-4 mt-1 mb-1 w-px h-3 bg-border" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Final result */}
          {finalResult && (
            <div className="bg-white rounded-xl border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle className="w-5 h-5" />
                  <h3 className="font-semibold">Contenido listo</h3>
                </div>
                <button type="button" onClick={resetPipeline}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5" /> Crear otro
                </button>
              </div>

              {/* Media */}
              {finalResult.videoUrl && (
                <div className="rounded-xl overflow-hidden bg-black">
                  <video src={finalResult.videoUrl} controls className="w-full max-h-96 object-contain" />
                </div>
              )}
              {!finalResult.videoUrl && finalResult.imageUrl && (
                <div className="rounded-xl overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={finalResult.imageUrl} alt="Imagen generada" className="w-full max-h-96 object-contain" />
                </div>
              )}

              {/* Caption */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-muted-foreground">Caption</label>
                  <button type="button"
                    onClick={() => { navigator.clipboard.writeText(finalResult.caption); toast.success("Copiado"); }}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <Copy className="w-3 h-3" /> Copiar
                  </button>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-sm whitespace-pre-wrap">{finalResult.caption}</div>
              </div>

              {/* Hashtags */}
              {finalResult.hashtags.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Hashtags ({finalResult.hashtags.length})
                    </label>
                    <button type="button"
                      onClick={() => {
                        const text = finalResult.hashtags.map((h) => `#${h}`).join(" ");
                        navigator.clipboard.writeText(text);
                        toast.success("Hashtags copiados");
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <Copy className="w-3 h-3" /> Copiar todos
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {finalResult.hashtags.map((tag) => (
                      <span key={tag} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Link href={`/calendar?postId=${finalResult.postId}`}
                  className="flex-1 text-center bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
                  Programar publicación
                </Link>
                <button type="button" onClick={resetPipeline}
                  className="px-4 py-2.5 border rounded-xl text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Crear otro
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* If running and no result yet — show generating hint */}
      {running && !finalResult && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-indigo-600 animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-indigo-800">Generando tu contenido...</p>
            <p className="text-xs text-indigo-600 mt-0.5">
              Los videos pueden tardar varios minutos. No cierres esta ventana.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
