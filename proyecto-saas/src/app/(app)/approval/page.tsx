"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { CheckSquare, Check, X, Clock, Loader2 } from "lucide-react";
import { PlatformIcon } from "@/components/accounts/PlatformIcon";
import { FORMAT_EMOJI, STATUS_COLORS } from "@/lib/utils/platform";
import { formatDateTime } from "@/lib/utils/dates";
import { toast } from "sonner";
import type { ScheduledPost } from "@/types/database";
import { cn } from "@/lib/utils/cn";

export default function ApprovalPage() {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const { data: posts = [], isLoading } = useQuery<ScheduledPost[]>({
    queryKey: ["approval", activeWorkspaceId],
    queryFn: async () => {
      const res = await fetch("/api/approval", {
        headers: { "x-workspace-id": activeWorkspaceId! },
      });
      const json = await res.json();
      return json.data ?? [];
    },
    enabled: !!activeWorkspaceId,
  });

  const approveMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/approval/${postId}/approve`, {
        method: "POST",
        headers: { "x-workspace-id": activeWorkspaceId! },
      });
      if (!res.ok) throw new Error("Error al aprobar");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval", activeWorkspaceId] });
      toast.success("Publicación aprobada");
    },
    onError: () => toast.error("Error al aprobar la publicación"),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ postId, reason }: { postId: string; reason: string }) => {
      const res = await fetch(`/api/approval/${postId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-workspace-id": activeWorkspaceId! },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Error al rechazar");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approval", activeWorkspaceId] });
      setRejectingId(null);
      setRejectReason("");
      toast.success("Publicación rechazada");
    },
    onError: () => toast.error("Error al rechazar la publicación"),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CheckSquare className="w-6 h-6 text-indigo-600" />
          Cola de aprobación
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {posts.length} publicación{posts.length !== 1 ? "es" : ""} pendiente{posts.length !== 1 ? "s" : ""} de revisión
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-xl border p-16 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Todo al día</h3>
          <p className="text-muted-foreground text-sm">No hay publicaciones pendientes de aprobación</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const account = post.social_account;
            const content = post.generated_post;
            const isRejecting = rejectingId === post.id;

            return (
              <div key={post.id} className="bg-white rounded-xl border overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 p-4 border-b bg-muted/30">
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
                    <p className="font-medium text-sm">{account?.account_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Programado: {formatDateTime(post.scheduled_at)}
                      </span>
                      {content?.format && (
                        <span className="text-xs">{FORMAT_EMOJI[content.format]}</span>
                      )}
                    </div>
                  </div>
                  <span className={cn(
                    "text-xs px-2.5 py-1 rounded-full font-medium",
                    STATUS_COLORS["pending_approval"]
                  )}>
                    Pendiente
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  {/* Media preview */}
                  {content?.media_urls && content.media_urls.length > 0 && (
                    <div className="rounded-lg overflow-hidden max-h-64 bg-muted">
                      {content.media_urls[0].match(/\.(mp4|mov|webm)$/) ? (
                        <video src={content.media_urls[0]} controls className="w-full max-h-64 object-contain" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={content.media_urls[0]} alt="" className="w-full max-h-64 object-cover" />
                      )}
                    </div>
                  )}

                  {/* Caption */}
                  {content?.caption && (
                    <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                      {content.caption}
                    </div>
                  )}

                  {/* Hashtags */}
                  {content?.hashtags && content.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {content.hashtags.map((tag) => (
                        <span key={tag} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Reject reason input */}
                  {isRejecting && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        Motivo del rechazo
                      </label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={2}
                        placeholder="¿Por qué rechazas esta publicación?"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    {isRejecting ? (
                      <>
                        <button
                          onClick={() => rejectMutation.mutate({ postId: post.id, reason: rejectReason })}
                          disabled={rejectMutation.isPending}
                          className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                          Confirmar rechazo
                        </button>
                        <button
                          onClick={() => { setRejectingId(null); setRejectReason(""); }}
                          className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => approveMutation.mutate(post.id)}
                          disabled={approveMutation.isPending}
                          className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                          {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          Aprobar
                        </button>
                        <button
                          onClick={() => setRejectingId(post.id)}
                          className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors flex items-center gap-2"
                        >
                          <X className="w-4 h-4" />
                          Rechazar
                        </button>
                      </>
                    )}
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
