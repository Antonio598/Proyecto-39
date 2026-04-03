"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Loader2, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PLATFORM_LABELS, FORMAT_LABELS, PLATFORM_FORMATS } from "@/lib/utils/platform";
import type { SocialPlatform, PostFormat, SocialAccount } from "@/types/database";

const TONES = ["profesional", "casual", "divertido", "inspirador", "informativo", "urgente"];
const LANGUAGES = [{ value: "es", label: "Español" }, { value: "en", label: "English" }, { value: "pt", label: "Português" }];

type JobStatus = "idle" | "submitting" | "polling" | "completed" | "failed";

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
  const [jobStatus, setJobStatus] = useState<JobStatus>("idle");
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [result, setResult] = useState<{
    caption?: string; hashtags?: string[]; mediaUrls?: string[]; postId?: string;
  } | null>(null);

  // Fetch accounts
  const { data: accounts = [] } = useQuery<SocialAccount[]>({
    queryKey: ["accounts", activeWorkspaceId],
    queryFn: async () => {
      const res = await fetch("/api/social-accounts", {
        headers: { "x-workspace-id": activeWorkspaceId! },
      });
      const json = await res.json();
      return json.data ?? [];
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
  }, [platform]);

  // Poll job status
  useEffect(() => {
    if (jobStatus !== "polling" || !currentJobId) return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/ai/status/${currentJobId}`, {
        headers: { "x-workspace-id": activeWorkspaceId! },
      });
      const json = await res.json();
      const data = json.data;

      if (data.status === "completed") {
        setResult(data.result);
        setJobStatus("completed");
        clearInterval(interval);
        toast.success("¡Contenido generado correctamente!");
      } else if (data.status === "failed") {
        setJobStatus("failed");
        clearInterval(interval);
        toast.error("Error al generar el contenido");
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobStatus, currentJobId, activeWorkspaceId]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspaceId || !promptText.trim()) return;

    setJobStatus("submitting");
    setResult(null);

    const res = await fetch("/api/ai/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-workspace-id": activeWorkspaceId,
      },
      body: JSON.stringify({ format, platform, promptText, tone, language, useHashtags, useEmojis }),
    });

    const json = await res.json();

    if (!res.ok) {
      toast.error(json.error ?? "Error al iniciar la generación");
      setJobStatus("failed");
      return;
    }

    setCurrentJobId(json.data.jobId);
    setJobStatus("polling");
  }

  const isGenerating = jobStatus === "submitting" || jobStatus === "polling";

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
          Describe tu contenido y la IA lo generará automáticamente
        </p>
      </div>

      <form onSubmit={handleGenerate} className="space-y-5">
        {/* Platform + Format */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h3 className="font-semibold text-sm">Red social y formato</h3>
          <div className="grid grid-cols-3 gap-2">
            {(["instagram", "facebook", "youtube"] as SocialPlatform[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
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

        <button
          type="submit"
          disabled={isGenerating || !promptText.trim()}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generando contenido...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Generar contenido</>
          )}
        </button>
      </form>

      {/* Result */}
      {jobStatus === "completed" && result && (
        <div className="bg-white rounded-xl border p-5 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle className="w-5 h-5" />
            <h3 className="font-semibold">Contenido generado</h3>
          </div>

          {result.mediaUrls && result.mediaUrls.length > 0 && (
            <div className="rounded-lg overflow-hidden bg-muted">
              {result.mediaUrls[0].match(/\.(mp4|mov|webm)$/) ? (
                <video src={result.mediaUrls[0]} controls className="w-full max-h-80 object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={result.mediaUrls[0]} alt="Contenido generado" className="w-full max-h-80 object-contain" />
              )}
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
              onClick={() => { setJobStatus("idle"); setResult(null); }}
              className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              Generar otro
            </button>
          </div>
        </div>
      )}

      {jobStatus === "failed" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">Error al generar el contenido</p>
            <p className="text-xs text-red-600 mt-0.5">
              Verifica que las API keys de IA estén configuradas en Configuración del workspace.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
