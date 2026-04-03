"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { Palette, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BrandForm {
  primaryColor: string;
  secondaryColor: string;
  fontPrimary: string;
  toneOfVoice: string;
  niche: string;
  guidelines: string;
  aiContext: string;
  nanoBananaKey: string;
  klingKey: string;
}

const DEFAULT_FORM: BrandForm = {
  primaryColor: "#6366f1",
  secondaryColor: "#8b5cf6",
  fontPrimary: "Inter",
  toneOfVoice: "profesional",
  niche: "",
  guidelines: "",
  aiContext: "",
  nanoBananaKey: "",
  klingKey: "",
};

export default function BrandPage() {
  const { activeWorkspaceId } = useWorkspace();
  const [form, setForm] = useState<BrandForm>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    fetch("/api/brand", { headers: { "x-workspace-id": activeWorkspaceId } })
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setForm({
            primaryColor: json.data.primary_color ?? DEFAULT_FORM.primaryColor,
            secondaryColor: json.data.secondary_color ?? DEFAULT_FORM.secondaryColor,
            fontPrimary: json.data.font_primary ?? DEFAULT_FORM.fontPrimary,
            toneOfVoice: json.data.tone_of_voice ?? DEFAULT_FORM.toneOfVoice,
            niche: json.data.niche ?? "",
            guidelines: json.data.guidelines ?? "",
            aiContext: json.data.ai_context ?? "",
            nanoBananaKey: "", // Never return keys to frontend
            klingKey: "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, [activeWorkspaceId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspaceId) return;
    setSaving(true);

    const res = await fetch("/api/brand", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workspace-id": activeWorkspaceId },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      toast.success("Kit de marca guardado correctamente");
    } else {
      toast.error("Error al guardar");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Palette className="w-6 h-6 text-indigo-600" />
          Kit de marca
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Define los colores, tono y contexto de tu marca para la generación de contenido con IA
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Colors */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h3 className="font-semibold text-sm">Identidad visual</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Color principal</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                />
                <input
                  type="text"
                  value={form.primaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Color secundario</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.secondaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value }))}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                />
                <input
                  type="text"
                  value={form.secondaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value }))}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Brand voice */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h3 className="font-semibold text-sm">Voz de marca</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tono de voz</label>
              <select
                value={form.toneOfVoice}
                onChange={(e) => setForm((f) => ({ ...f, toneOfVoice: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {["profesional", "casual", "divertido", "inspirador", "educativo", "urgente"].map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nicho / industria</label>
              <input
                type="text"
                value={form.niche}
                onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}
                placeholder="Ej: fitness, moda, tecnología..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Guías de marca
            </label>
            <textarea
              value={form.guidelines}
              onChange={(e) => setForm((f) => ({ ...f, guidelines: e.target.value }))}
              rows={3}
              placeholder="Describe los valores, misión y restricciones de tu marca..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Contexto para IA
              <span className="ml-1 text-indigo-500">(se inyecta en todos los prompts)</span>
            </label>
            <textarea
              value={form.aiContext}
              onChange={(e) => setForm((f) => ({ ...f, aiContext: e.target.value }))}
              rows={3}
              placeholder="Ej: Somos una marca de ropa sostenible para mujeres 25-40. Usamos siempre lenguaje inclusivo, enfocado en empoderamiento..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        </div>

        {/* AI API Keys */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-sm">API Keys de IA</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tus API keys se almacenan de forma segura y solo se usan para generar contenido
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Nano Banana API Key
              <span className="ml-1 text-muted-foreground/60">(imágenes y texto)</span>
            </label>
            <input
              type="password"
              value={form.nanoBananaKey}
              onChange={(e) => setForm((f) => ({ ...f, nanoBananaKey: e.target.value }))}
              placeholder="nb_sk_..."
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Kling API Key
              <span className="ml-1 text-muted-foreground/60">(videos, Reels, Shorts)</span>
            </label>
            <input
              type="password"
              value={form.klingKey}
              onChange={(e) => setForm((f) => ({ ...f, klingKey: e.target.value }))}
              placeholder="kling_..."
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Guardando..." : "Guardar kit de marca"}
        </button>
      </form>
    </div>
  );
}
