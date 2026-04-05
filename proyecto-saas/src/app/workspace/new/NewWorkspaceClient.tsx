"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Building2, Plus, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Workspace {
  id: string;
  name: string;
  role: string;
}

export function NewWorkspaceClient({ existingWorkspaces }: { existingWorkspaces: Workspace[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"select" | "create">(
    existingWorkspaces.length > 0 ? "select" : "create"
  );

  async function handleSelect(workspaceId: string) {
    setSwitching(workspaceId);
    // Set workspace cookie via Supabase client route
    const supabase = createClient();
    await supabase.auth.getUser(); // ensure session
    document.cookie = `workspace_id=${workspaceId}; path=/; max-age=31536000`;
    router.push("/dashboard");
    router.refresh();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Error al crear el workspace");
      setLoading(false);
      return;
    }

    // Set the new workspace as active
    document.cookie = `workspace_id=${json.data.id}; path=/; max-age=31536000`;
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-sm border p-8 w-full max-w-md">

        {mode === "select" && existingWorkspaces.length > 0 ? (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Selecciona un workspace</h1>
              <p className="text-sm text-gray-500 mt-1">
                Elige el workspace al que deseas acceder.
              </p>
            </div>

            <div className="space-y-2 mb-4">
              {existingWorkspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => handleSelect(ws.id)}
                  disabled={switching === ws.id}
                  className="w-full flex items-center justify-between p-4 border rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{ws.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{ws.role}</p>
                    </div>
                  </div>
                  {switching === ws.id
                    ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    : <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                  }
                </button>
              ))}
            </div>

            <button
              onClick={() => setMode("create")}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all"
            >
              <Plus className="w-4 h-4" />
              Crear nuevo workspace
            </button>
          </>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Crea tu workspace</h1>
              <p className="text-sm text-gray-500 mt-1">
                Un workspace es el espacio donde gestionarás el contenido de tu marca.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de tu empresa / marca
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Mi Agencia Digital"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Creando..." : "Crear workspace"}
              </button>
            </form>

            {existingWorkspaces.length > 0 && (
              <button
                onClick={() => setMode("select")}
                className="w-full mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                ← Volver a mis workspaces
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
