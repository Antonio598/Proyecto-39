"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { ArrowLeft, Zap, Plus, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { DAY_NAMES, FORMAT_LABELS, PLATFORM_LABELS, PLATFORM_FORMATS } from "@/lib/utils/platform";
import { PlatformIcon } from "@/components/accounts/PlatformIcon";
import type { SocialAccount, SocialPlatform, PostFormat } from "@/types/database";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export default function CreateRulePage() {
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [publishMode, setPublishMode] = useState<"auto" | "approval">("approval");
  const [frequencyType, setFrequencyType] = useState<"day" | "week">("day");
  const [postsPerDay, setPostsPerDay] = useState(1);
  const [postsPerWeek, setPostsPerWeek] = useState(3);
  const [allowedDays, setAllowedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [timeSlots, setTimeSlots] = useState([{ hour: 9, minute: 0 }]);
  const [formats, setFormats] = useState<PostFormat[]>(["image"]);

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

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const availableFormats: PostFormat[] = selectedAccount
    ? (PLATFORM_FORMATS[selectedAccount.platform as SocialPlatform] ?? [])
    : ["image", "carousel", "reel", "story", "text"];

  // Reset formats when account changes
  useEffect(() => {
    setFormats([]);
  }, [accountId]);

  function toggleDay(day: number) {
    setAllowedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  function toggleFormat(f: PostFormat) {
    setFormats((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  }

  function addTimeSlot() {
    if (timeSlots.length >= 10) return;
    setTimeSlots((prev) => [...prev, { hour: 12, minute: 0 }]);
  }

  function removeTimeSlot(i: number) {
    setTimeSlots((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateTimeSlot(i: number, field: "hour" | "minute", value: number) {
    setTimeSlots((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspaceId) return;

    if (!accountId) { toast.error("Selecciona una cuenta"); return; }
    if (allowedDays.length === 0) { toast.error("Selecciona al menos un día"); return; }
    if (timeSlots.length === 0) { toast.error("Agrega al menos un horario"); return; }
    if (formats.length === 0) { toast.error("Selecciona al menos un formato"); return; }

    setSaving(true);

    const body = {
      socialAccountId: accountId,
      name,
      postsPerDay: frequencyType === "day" ? postsPerDay : undefined,
      postsPerWeek: frequencyType === "week" ? postsPerWeek : undefined,
      allowedDays,
      timeSlots,
      formats,
      publishMode,
    };

    const res = await fetch("/api/automation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-workspace-id": activeWorkspaceId,
      },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok) {
      toast.error(json.error?.formErrors?.[0] ?? "Error al crear la regla");
      setSaving(false);
      return;
    }

    toast.success("Regla creada correctamente");
    router.push("/automation");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/automation" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver a automatización
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="w-6 h-6 text-indigo-600" />
          Nueva regla de automatización
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Define cuándo y cómo publicar contenido automáticamente
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold text-sm">Información básica</h3>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nombre de la regla</label>
            <input
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Instagram Reels diarios"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Cuenta social</label>
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay cuentas conectadas.{" "}
                <Link href="/accounts/connect" className="text-indigo-600 hover:underline">Conectar una cuenta</Link>
              </p>
            ) : (
              <select
                required
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Seleccionar cuenta...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {PLATFORM_LABELS[a.platform as SocialPlatform]} — {a.account_name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Formats */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold text-sm">Formatos de contenido</h3>
          <div className="flex flex-wrap gap-2">
            {availableFormats.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => toggleFormat(f)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  formats.includes(f)
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-border hover:border-indigo-200 text-muted-foreground"
                }`}
              >
                {FORMAT_LABELS[f]}
              </button>
            ))}
          </div>
          {formats.length === 0 && (
            <p className="text-xs text-red-500">Selecciona al menos un formato</p>
          )}
        </div>

        {/* Frequency */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h3 className="font-semibold text-sm">Frecuencia de publicación</h3>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFrequencyType("day")}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                frequencyType === "day"
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-border text-muted-foreground hover:border-indigo-200"
              }`}
            >
              Por día
            </button>
            <button
              type="button"
              onClick={() => setFrequencyType("week")}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                frequencyType === "week"
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-border text-muted-foreground hover:border-indigo-200"
              }`}
            >
              Por semana
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {frequencyType === "day" ? "Posts por día:" : "Posts por semana:"}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => frequencyType === "day"
                  ? setPostsPerDay((v) => Math.max(1, v - 1))
                  : setPostsPerWeek((v) => Math.max(1, v - 1))}
                className="w-8 h-8 rounded-lg border flex items-center justify-center font-bold hover:bg-muted"
              >
                -
              </button>
              <span className="w-8 text-center font-semibold text-sm">
                {frequencyType === "day" ? postsPerDay : postsPerWeek}
              </span>
              <button
                type="button"
                onClick={() => frequencyType === "day"
                  ? setPostsPerDay((v) => Math.min(20, v + 1))
                  : setPostsPerWeek((v) => Math.min(50, v + 1))}
                className="w-8 h-8 rounded-lg border flex items-center justify-center font-bold hover:bg-muted"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Days */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold text-sm">Días de publicación</h3>
          <div className="flex gap-2 flex-wrap">
            {ALL_DAYS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`w-12 h-12 rounded-xl border text-xs font-semibold transition-colors ${
                  allowedDays.includes(day)
                    ? "border-indigo-500 bg-indigo-600 text-white"
                    : "border-border text-muted-foreground hover:border-indigo-200"
                }`}
              >
                {DAY_NAMES[day]}
              </button>
            ))}
          </div>
          {allowedDays.length === 0 && (
            <p className="text-xs text-red-500">Selecciona al menos un día</p>
          )}
        </div>

        {/* Time slots */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Horarios de publicación</h3>
            <button
              type="button"
              onClick={addTimeSlot}
              disabled={timeSlots.length >= 10}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar horario
            </button>
          </div>

          <div className="space-y-2">
            {timeSlots.map((slot, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 flex-1">
                  <select
                    value={slot.hour}
                    onChange={(e) => updateTimeSlot(i, "hour", Number(e.target.value))}
                    className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{String(h).padStart(2, "0")}h</option>
                    ))}
                  </select>
                  <span className="text-muted-foreground text-sm">:</span>
                  <select
                    value={slot.minute}
                    onChange={(e) => updateTimeSlot(i, "minute", Number(e.target.value))}
                    className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {[0, 15, 30, 45].map((m) => (
                      <option key={m} value={m}>{String(m).padStart(2, "0")}min</option>
                    ))}
                  </select>
                </div>
                {timeSlots.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTimeSlot(i)}
                    className="p-1.5 text-muted-foreground hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Publish mode */}
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold text-sm">Modo de publicación</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPublishMode("approval")}
              className={`p-4 rounded-xl border text-left transition-colors ${
                publishMode === "approval"
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-border hover:border-indigo-200"
              }`}
            >
              <p className={`text-sm font-semibold ${publishMode === "approval" ? "text-indigo-700" : ""}`}>
                Con aprobación
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Revisas cada post antes de publicar
              </p>
            </button>
            <button
              type="button"
              onClick={() => setPublishMode("auto")}
              className={`p-4 rounded-xl border text-left transition-colors ${
                publishMode === "auto"
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-border hover:border-indigo-200"
              }`}
            >
              <p className={`text-sm font-semibold ${publishMode === "auto" ? "text-indigo-700" : ""}`}>
                Automático
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Se publica sin intervención manual
              </p>
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !accountId || formats.length === 0 || allowedDays.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Creando regla...</>
          ) : (
            <><Zap className="w-4 h-4" /> Crear regla</>
          )}
        </button>
      </form>
    </div>
  );
}
