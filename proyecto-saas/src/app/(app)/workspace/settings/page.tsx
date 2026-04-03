"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { Settings, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function WorkspaceSettingsPage() {
  const { activeWorkspaceId, workspaces } = useWorkspace();
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const [name, setName] = useState(activeWs?.name ?? "");
  const [timezone, setTimezone] = useState(activeWs?.timezone ?? "UTC");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(activeWs?.name ?? "");
    setTimezone(activeWs?.timezone ?? "UTC");
  }, [activeWs]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspaceId) return;
    setSaving(true);

    const res = await fetch(`/api/workspaces/${activeWorkspaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-workspace-id": activeWorkspaceId },
      body: JSON.stringify({ name, timezone }),
    });

    if (res.ok) toast.success("Configuración guardada");
    else toast.error("Error al guardar");
    setSaving(false);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-600" />
          Configuración del workspace
        </h1>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Nombre del workspace</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Zona horaria</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {["UTC", "America/Mexico_City", "America/Bogota", "America/Lima",
              "America/Santiago", "America/Buenos_Aires", "America/New_York",
              "America/Los_Angeles", "Europe/Madrid", "Europe/London"].map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar cambios
        </button>
      </form>
    </div>
  );
}
