"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { KeyRound, Save, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface KeyField {
  id: "openaiKey" | "nanoBananaKey" | "klingKey";
  label: string;
  subtitle: string;
  placeholder: string;
  description: string;
  emoji: string;
  gradient: string;
  borderColor: string;
  purpose: string;
  required: boolean;
}

const KEY_FIELDS: KeyField[] = [
  {
    id: "openaiKey",
    label: "OpenAI API Key",
    subtitle: "Guiones y copy (GPT-4o mini)",
    placeholder: "sk-...",
    description: "Genera los guiones, captions, hashtags y prompts de imagen/video con GPT-4o mini. Requerida para iniciar el pipeline.",
    emoji: "🤖",
    gradient: "from-emerald-50 to-teal-50",
    borderColor: "border-emerald-100",
    purpose: "Guiones, captions y hashtags",
    required: true,
  },
  {
    id: "nanoBananaKey",
    label: "Nano Banana API Key",
    subtitle: "Generación de imágenes",
    placeholder: "nb_sk_...",
    description: "Genera imágenes de alta calidad para posts, carruseles y stories. Requerida para formatos de imagen.",
    emoji: "🍌",
    gradient: "from-orange-50 to-yellow-50",
    borderColor: "border-orange-100",
    purpose: "Fotos, carruseles, stories",
    required: false,
  },
  {
    id: "klingKey",
    label: "Kling AI API Key",
    subtitle: "Generación de videos",
    placeholder: "kling_...",
    description: "Convierte imágenes en videos cinematográficos. Requerida para Reels, Shorts y videos largos.",
    emoji: "🎬",
    gradient: "from-purple-50 to-indigo-50",
    borderColor: "border-purple-100",
    purpose: "Reels, Shorts, videos",
    required: false,
  },
];

export default function IntegrationsPage() {
  const { activeWorkspaceId } = useWorkspace();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<Record<string, string>>({
    openaiKey: "",
    nanoBananaKey: "",
    klingKey: "",
  });
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  // Load which keys are already configured
  useEffect(() => {
    if (!activeWorkspaceId) return;
    fetch("/api/brand", { headers: { "x-workspace-id": activeWorkspaceId } })
      .then((r) => r.json())
      .then((json) => {
        if (json.keys) {
          setSaved({
            openaiKey: !!json.keys.hasOpenaiKey,
            nanoBananaKey: !!json.keys.hasNanoBananaKey,
            klingKey: !!json.keys.hasKlingKey,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [activeWorkspaceId]);

  function toggleShow(id: string) {
    setShow((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspaceId) return;

    const hasAny = Object.values(keys).some((v) => v.trim() !== "");
    if (!hasAny) {
      toast.error("Ingresa al menos una API key");
      return;
    }

    setSaving(true);

    const res = await fetch("/api/brand", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workspace-id": activeWorkspaceId },
      body: JSON.stringify(keys),
    });

    if (res.ok) {
      toast.success("API keys guardadas correctamente");
      const newSaved: Record<string, boolean> = { ...saved };
      KEY_FIELDS.forEach(({ id }) => {
        if (keys[id]) newSaved[id] = true;
      });
      setSaved(newSaved);
      setKeys({ openaiKey: "", nanoBananaKey: "", klingKey: "" });
    } else {
      toast.error("Error al guardar las API keys");
    }
    setSaving(false);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-indigo-600" />
          Integraciones de IA
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configura las APIs necesarias para el pipeline completo de generación de contenido
        </p>
      </div>

      {/* Pipeline flow */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-5">
        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-3">Pipeline de creación</p>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: "Descripción", sub: "Tú escribes", emoji: "✍️" },
            { arrow: true },
            { label: "Guión + Copy", sub: "OpenAI GPT", emoji: "🤖", required: true },
            { arrow: true },
            { label: "Imagen", sub: "Nano Banana", emoji: "🍌" },
            { arrow: true },
            { label: "Video", sub: "Kling AI", emoji: "🎬" },
          ].map((item, i) =>
            "arrow" in item ? (
              <span key={i} className="text-indigo-300 font-bold text-lg">→</span>
            ) : (
              <div key={i} className={`text-center px-3 py-2 rounded-lg bg-white border ${item.required ? "border-indigo-300 shadow-sm" : "border-indigo-100"}`}>
                <div className="text-xl">{item.emoji}</div>
                <p className="text-xs font-semibold mt-0.5">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.sub}</p>
                {item.required && (
                  <span className="text-[9px] text-red-500 font-medium">Requerida</span>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {/* Key fields */}
      <form onSubmit={handleSave} className="space-y-4">
        {KEY_FIELDS.map(({ id, label, subtitle, placeholder, description, emoji, gradient, borderColor, purpose }) => (
          <div key={id} className={`bg-gradient-to-br ${gradient} border ${borderColor} rounded-xl p-5`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{label}</h3>
                    {saved[id] && (
                      <div className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-medium">Guardada</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                </div>
              </div>
              <span className="text-xs bg-white/60 px-2 py-0.5 rounded-full text-muted-foreground border">
                {purpose}
              </span>
            </div>

            <div className="relative mb-2">
              <input
                type={show[id] ? "text" : "password"}
                value={keys[id]}
                onChange={(e) => setKeys((prev) => ({ ...prev, [id]: e.target.value }))}
                placeholder={saved[id] ? "••••••••••••••• (guardada — escribe para actualizar)" : placeholder}
                className="w-full border bg-white rounded-lg px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => toggleShow(id)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {show[id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        ))}

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            <strong>Seguridad:</strong> Las API keys se almacenan de forma encriptada en los metadatos de tu workspace. Nunca se exponen al navegador ni se incluyen en respuestas de la API. Solo se usan server-side para la generación.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving || Object.values(keys).every((v) => !v.trim())}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
          ) : (
            <><Save className="w-4 h-4" /> Guardar API keys</>
          )}
        </button>
      </form>
    </div>
  );
}
