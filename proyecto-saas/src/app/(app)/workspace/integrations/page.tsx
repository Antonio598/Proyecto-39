"use client";

import { useState } from "react";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { KeyRound, Save, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function IntegrationsPage() {
  const { activeWorkspaceId } = useWorkspace();
  const [saving, setSaving] = useState(false);
  const [nanoBananaKey, setNanoBananaKey] = useState("");
  const [klingKey, setKlingKey] = useState("");
  const [showNb, setShowNb] = useState(false);
  const [showKling, setShowKling] = useState(false);
  const [savedNb, setSavedNb] = useState(false);
  const [savedKling, setSavedKling] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspaceId) return;
    if (!nanoBananaKey && !klingKey) {
      toast.error("Ingresa al menos una API key");
      return;
    }

    setSaving(true);

    const res = await fetch("/api/brand", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workspace-id": activeWorkspaceId },
      body: JSON.stringify({ nanoBananaKey, klingKey }),
    });

    if (res.ok) {
      toast.success("API keys guardadas correctamente");
      if (nanoBananaKey) setSavedNb(true);
      if (klingKey) setSavedKling(true);
      setNanoBananaKey("");
      setKlingKey("");
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
          Configura las API keys para generar imágenes y videos con inteligencia artificial
        </p>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border border-orange-100 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-2xl">🍌</div>
            {savedNb && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          </div>
          <h3 className="font-semibold text-sm">Nano Banana</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Genera imágenes y copy para posts, carruseles y stories con IA.
          </p>
          <p className="text-xs text-orange-600 font-medium mt-2">
            {savedNb ? "✓ Key configurada" : "Requerida para fotos e imágenes"}
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-2xl">🎬</div>
            {savedKling && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          </div>
          <h3 className="font-semibold text-sm">Kling AI</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Genera videos, Reels, Shorts y videos largos con IA avanzada.
          </p>
          <p className="text-xs text-purple-600 font-medium mt-2">
            {savedKling ? "✓ Key configurada" : "Requerida para videos y Reels"}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="bg-white rounded-xl border p-6 space-y-5">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Configurar API Keys
          </h2>

          {/* Nano Banana */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Nano Banana API Key
              <span className="ml-2 text-xs font-normal text-muted-foreground">(imágenes y copy)</span>
            </label>
            <div className="relative">
              <input
                type={showNb ? "text" : "password"}
                value={nanoBananaKey}
                onChange={(e) => setNanoBananaKey(e.target.value)}
                placeholder="nb_sk_..."
                className="w-full border rounded-lg px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowNb((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNb ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Obtén tu key en el dashboard de Nano Banana
            </p>
          </div>

          {/* Kling */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Kling AI API Key
              <span className="ml-2 text-xs font-normal text-muted-foreground">(videos, Reels, Shorts)</span>
            </label>
            <div className="relative">
              <input
                type={showKling ? "text" : "password"}
                value={klingKey}
                onChange={(e) => setKlingKey(e.target.value)}
                placeholder="kling_..."
                className="w-full border rounded-lg px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowKling((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKling ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Obtén tu key en el dashboard de Kling AI
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
            <p className="text-xs text-amber-700">
              <strong>Seguridad:</strong> Las API keys se almacenan de forma encriptada y nunca se exponen al navegador. Solo se usan internamente para generar contenido.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || (!nanoBananaKey && !klingKey)}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
          ) : (
            <><Save className="w-4 h-4" /> Guardar API keys</>
          )}
        </button>
      </form>

      {/* Flow explanation */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold mb-4">¿Cómo funciona la generación con IA?</h2>
        <div className="space-y-3">
          {[
            { step: "1", title: "Generas el copy", desc: "Nano Banana crea el caption, hashtags y texto optimizado para cada plataforma.", color: "bg-orange-100 text-orange-700" },
            { step: "2", title: "Generas la imagen", desc: "Nano Banana crea la imagen visual basada en tu prompt y el copy generado.", color: "bg-blue-100 text-blue-700" },
            { step: "3", title: "Generas el video", desc: "Kling AI convierte la imagen en un video o Reel animado listo para publicar.", color: "bg-purple-100 text-purple-700" },
          ].map(({ step, title, desc, color }) => (
            <div key={step} className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-full ${color} flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                {step}
              </div>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
