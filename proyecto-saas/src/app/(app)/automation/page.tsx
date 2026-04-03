"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { Zap, Plus, ToggleLeft, ToggleRight, Trash2, Clock, Calendar } from "lucide-react";
import { DAY_NAMES, FORMAT_LABELS, PLATFORM_LABELS } from "@/lib/utils/platform";
import { PlatformIcon } from "@/components/accounts/PlatformIcon";
import Link from "next/link";
import { toast } from "sonner";
import type { PostingRule } from "@/types/database";

export default function AutomationPage() {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery<PostingRule[]>({
    queryKey: ["rules", activeWorkspaceId],
    queryFn: async () => {
      const res = await fetch("/api/automation", {
        headers: { "x-workspace-id": activeWorkspaceId! },
      });
      const json = await res.json();
      return json.data ?? [];
    },
    enabled: !!activeWorkspaceId,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      const res = await fetch(`/api/automation/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-workspace-id": activeWorkspaceId! },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Error");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules", activeWorkspaceId] });
      toast.success("Regla actualizada");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const res = await fetch(`/api/automation/${ruleId}`, {
        method: "DELETE",
        headers: { "x-workspace-id": activeWorkspaceId! },
      });
      if (!res.ok) throw new Error("Error");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules", activeWorkspaceId] });
      toast.success("Regla eliminada");
    },
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-indigo-600" />
            Automatización
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configura reglas de publicación automática por cuenta
          </p>
        </div>
        <Link
          href="/automation/create"
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva regla
        </Link>
      </div>

      {/* Example config */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-700">
        <p className="font-medium mb-1">Ejemplos de configuración:</p>
        <ul className="list-disc list-inside space-y-0.5 text-indigo-600 text-xs">
          <li>Instagram cuenta 1 → 2 reels diarios a las 9am y 6pm</li>
          <li>Instagram cuenta 2 → 3 carruseles/semana (lun, mié, vie)</li>
          <li>Facebook → 1 post cada 2 días a las 12pm</li>
          <li>YouTube → 3 shorts semanales (mar, jue, sáb)</li>
        </ul>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-white rounded-xl border p-16 text-center">
          <Zap className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No hay reglas configuradas</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            Crea reglas de automatización para que el sistema genere y publique contenido en los horarios que definas.
          </p>
          <Link
            href="/automation/create"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Crear primera regla
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => {
            const account = rule.social_account;
            const slots = (rule.time_slots as Array<{ hour: number; minute: number }>) ?? [];

            return (
              <div key={rule.id} className="bg-white rounded-xl border p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {account && (
                      <PlatformIcon
                        platform={account.platform}
                        size="md"
                        className={
                          account.platform === "instagram" ? "text-pink-600" :
                          account.platform === "facebook" ? "text-blue-600" : "text-red-600"
                        }
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{rule.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          rule.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-500"
                        }`}>
                          {rule.is_active ? "Activa" : "Inactiva"}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          rule.publish_mode === "auto"
                            ? "bg-purple-50 text-purple-700"
                            : "bg-yellow-50 text-yellow-700"
                        }`}>
                          {rule.publish_mode === "auto" ? "Auto-publicación" : "Con aprobación"}
                        </span>
                      </div>

                      <p className="text-sm text-muted-foreground mt-0.5">
                        {account?.account_name} · {PLATFORM_LABELS[account?.platform ?? "instagram"]}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {rule.posts_per_day
                            ? `${rule.posts_per_day}/día`
                            : rule.posts_per_week
                            ? `${rule.posts_per_week}/semana`
                            : "Frecuencia no definida"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {rule.allowed_days.map((d) => DAY_NAMES[d]).join(", ")}
                        </span>
                        {slots.length > 0 && (
                          <span>
                            Horarios: {slots.map((s) => `${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`).join(", ")}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {rule.formats.map((f) => (
                          <span key={f} className="text-xs bg-muted px-2 py-0.5 rounded-full">
                            {FORMAT_LABELS[f]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleMutation.mutate({ ruleId: rule.id, isActive: !rule.is_active })}
                      className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title={rule.is_active ? "Desactivar" : "Activar"}
                    >
                      {rule.is_active
                        ? <ToggleRight className="w-5 h-5 text-emerald-600" />
                        : <ToggleLeft className="w-5 h-5" />
                      }
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("¿Eliminar esta regla?")) {
                          deleteMutation.mutate(rule.id);
                        }
                      }}
                      className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
