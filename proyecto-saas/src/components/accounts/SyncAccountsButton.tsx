"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function SyncAccountsButton({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    const res = await fetch("/api/social-accounts/sync", {
      method: "POST",
      headers: { "x-workspace-id": workspaceId },
    });
    const json = await res.json();
    if (res.ok) {
      if (json.saved === 0) {
        toast.warning(`Ninguna cuenta nueva. Plataformas encontradas: ${json.allPlatforms?.join(", ") || "ninguna"}`);
      } else {
        toast.success(`${json.saved} cuenta${json.saved !== 1 ? "s" : ""} sincronizada${json.saved !== 1 ? "s" : ""}`);
      }
      router.refresh();
    } else {
      toast.error(json.error ?? "Error al sincronizar");
    }
    setSyncing(false);
  }

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
    >
      <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
      Sincronizar
    </button>
  );
}
