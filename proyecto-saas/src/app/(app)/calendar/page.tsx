"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  isSameMonth, addMonths, subMonths, isToday, parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Calendar, Plus, List, X, Clock, Send, Loader2,
  Trash2, ExternalLink, CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { STATUS_COLORS, STATUS_LABELS, FORMAT_EMOJI } from "@/lib/utils/platform";
import { PlatformIcon } from "@/components/accounts/PlatformIcon";
import { toast } from "sonner";
import Link from "next/link";
import type { ScheduledPost, SocialAccount } from "@/types/database";

async function fetchPosts(workspaceId: string, from: string, to: string) {
  const params = new URLSearchParams({ from, to });
  const res = await fetch(`/api/posts?${params}`, {
    headers: { "x-workspace-id": workspaceId },
  });
  return ((await res.json()).data ?? []) as ScheduledPost[];
}

// Posts that can still be published
const PUBLISHABLE_STATUSES = ["approved", "scheduled", "pending_approval", "failed"];

function PostChip({ post, onClick }: { post: ScheduledPost; onClick: () => void }) {
  const account = post.social_account;
  const content = post.generated_post;
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        "text-xs px-1.5 py-0.5 rounded cursor-pointer truncate flex items-center gap-1 hover:opacity-80 transition-opacity",
        STATUS_COLORS[post.status]
      )}
    >
      {account && <PlatformIcon platform={account.platform} size="sm" className="w-3 h-3 flex-shrink-0" />}
      <span className="truncate">{content?.caption?.slice(0, 30) ?? account?.account_name ?? "Post"}</span>
    </div>
  );
}

export default function CalendarPage() {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "list">("month");
  const [activePost, setActivePost] = useState<ScheduledPost | null>(null);

  // Post detail modal
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [publishingNow, setPublishingNow] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);

  // Add-post modal state
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [scheduleTime, setScheduleTime] = useState("12:00");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [publishMode, setPublishMode] = useState<"auto" | "approval">("auto");
  const [saving, setSaving] = useState(false);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startPad = (monthStart.getDay() + 6) % 7;
  const paddedDays = [
    ...Array.from({ length: startPad }, (_, i) => {
      const d = new Date(monthStart);
      d.setDate(d.getDate() - (startPad - i));
      return d;
    }),
    ...days,
  ];

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts", activeWorkspaceId, monthStart.toISOString(), monthEnd.toISOString()],
    queryFn: () => fetchPosts(activeWorkspaceId!, monthStart.toISOString(), monthEnd.toISOString()),
    enabled: !!activeWorkspaceId,
  });

  const { data: accounts = [] } = useQuery<SocialAccount[]>({
    queryKey: ["accounts", activeWorkspaceId],
    queryFn: async () => {
      const res = await fetch("/api/social-accounts", { headers: { "x-workspace-id": activeWorkspaceId! } });
      return (await res.json()).data ?? [];
    },
    enabled: !!activeWorkspaceId,
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ postId, scheduledAt }: { postId: string; scheduledAt: string }) => {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-workspace-id": activeWorkspaceId! },
        body: JSON.stringify({ scheduledAt }),
      });
      if (!res.ok) throw new Error("Error al reprogramar");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts", activeWorkspaceId] });
      toast.success("Publicación reprogramada");
    },
    onError: () => toast.error("Error al reprogramar la publicación"),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActivePost(null);
    if (!over || active.id === over.id) return;
    const postId = active.id as string;
    const targetDate = over.id as string;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const originalTime = parseISO(post.scheduled_at);
    const newDate = new Date(targetDate);
    newDate.setHours(originalTime.getHours(), originalTime.getMinutes(), 0, 0);
    rescheduleMutation.mutate({ postId, scheduledAt: newDate.toISOString() });
  }

  function getPostsForDay(day: Date) {
    return posts.filter((p) => isSameDay(parseISO(p.scheduled_at), day));
  }

  function openDayModal(day: Date) {
    setSelectedDay(day);
    setScheduleTime("12:00");
    setSelectedAccountId("");
    setPublishMode("auto");
  }

  // Publish a post immediately (set scheduled_at to 1 min ago + status approved)
  async function publishPostNow(post: ScheduledPost) {
    if (!activeWorkspaceId) return;
    setPublishingNow(true);
    try {
      const publishAt = new Date(Date.now() - 60 * 1000).toISOString();
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-workspace-id": activeWorkspaceId },
        body: JSON.stringify({ scheduledAt: publishAt, status: "approved" }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Error al publicar");
      }
      queryClient.invalidateQueries({ queryKey: ["posts", activeWorkspaceId] });
      toast.success("✅ Publicación enviada al cron — estará publicada en menos de un minuto");
      setSelectedPost(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al publicar");
    } finally {
      setPublishingNow(false);
    }
  }

  // Delete a post
  async function deletePost(post: ScheduledPost) {
    if (!activeWorkspaceId) return;
    setDeletingPost(true);
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "DELETE",
        headers: { "x-workspace-id": activeWorkspaceId },
      });
      if (!res.ok) throw new Error("Error al eliminar");
      queryClient.invalidateQueries({ queryKey: ["posts", activeWorkspaceId] });
      toast.success("Publicación eliminada");
      setSelectedPost(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeletingPost(false);
    }
  }

  async function savePost() {
    if (!selectedDay || !selectedAccountId || !activeWorkspaceId) return;
    setSaving(true);
    try {
      const [h, m] = scheduleTime.split(":").map(Number);
      const scheduledAt = new Date(selectedDay);
      scheduledAt.setHours(h, m, 0, 0);

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-workspace-id": activeWorkspaceId },
        body: JSON.stringify({
          socialAccountId: selectedAccountId,
          scheduledAt: scheduledAt.toISOString(),
          publishMode,
        }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? "Error"); }
      queryClient.invalidateQueries({ queryKey: ["posts", activeWorkspaceId] });
      toast.success("Publicación programada");
      setSelectedDay(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al programar");
    } finally {
      setSaving(false);
    }
  }

  const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  const canPublishNow = selectedPost && PUBLISHABLE_STATUSES.includes(selectedPost.status);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            Calendario
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">{posts.length} publicaciones este mes</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button onClick={() => setViewMode("month")} className={cn("p-1.5 rounded-md text-sm transition-colors", viewMode === "month" ? "bg-white shadow-sm" : "text-muted-foreground")}>
              <Calendar className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode("list")} className={cn("p-1.5 rounded-md text-sm transition-colors", viewMode === "list" ? "bg-white shadow-sm" : "text-muted-foreground")}>
              <List className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold min-w-[140px] text-center capitalize">
              {format(currentDate, "MMMM yyyy", { locale: es })}
            </span>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-xs border rounded-lg hover:bg-muted transition-colors">
            Hoy
          </button>
          <Link href="/create/ai" className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" /> Crear con IA
          </Link>
        </div>
      </div>

      {viewMode === "month" ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="grid grid-cols-7 border-b">
              {DAY_NAMES.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground border-r last:border-0">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {paddedDays.map((day) => {
                const dayPosts = getPostsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isDayToday = isToday(day);
                return (
                  <div
                    key={day.toISOString()}
                    id={day.toISOString().split("T")[0]}
                    onClick={() => isCurrentMonth && openDayModal(day)}
                    className={cn(
                      "min-h-[100px] p-1.5 border-r border-b last:border-r-0 transition-colors group",
                      isCurrentMonth ? "cursor-pointer hover:bg-indigo-50/40" : "bg-muted/30",
                      isDayToday && "bg-indigo-50/50"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className={cn(
                        "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full",
                        isDayToday ? "bg-indigo-600 text-white" : isCurrentMonth ? "text-foreground" : "text-muted-foreground/50"
                      )}>
                        {format(day, "d")}
                      </div>
                      {isCurrentMonth && (
                        <Plus className="w-3 h-3 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {dayPosts.slice(0, 3).map((post) => (
                        <PostChip key={post.id} post={post} onClick={() => setSelectedPost(post)} />
                      ))}
                      {dayPosts.length > 3 && (
                        <div className="text-xs text-muted-foreground pl-1">+{dayPosts.length - 3} más</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <DragOverlay>{activePost && <PostChip post={activePost} onClick={() => {}} />}</DragOverlay>
        </DndContext>
      ) : (
        <div className="bg-white rounded-xl border divide-y">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando...</div>
          ) : posts.length === 0 ? (
            <div className="p-16 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="font-medium">No hay publicaciones este mes</p>
              <Link href="/create/ai" className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
                <Plus className="w-3 h-3" /> Crear contenido
              </Link>
            </div>
          ) : (
            posts.map((post) => {
              const account = post.social_account;
              const content = post.generated_post;
              const canPublish = PUBLISHABLE_STATUSES.includes(post.status);
              return (
                <div key={post.id} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
                  <div className="text-sm font-medium text-muted-foreground min-w-[120px]">
                    {format(parseISO(post.scheduled_at), "d MMM · HH:mm", { locale: es })}
                  </div>
                  {account && (
                    <PlatformIcon platform={account.platform} size="sm" className={
                      account.platform === "instagram" ? "text-pink-600" :
                      account.platform === "facebook" ? "text-blue-600" : "text-red-600"
                    } />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{account?.account_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{content?.caption ?? "Sin caption"}</p>
                  </div>
                  {content?.format && <span className="text-sm">{FORMAT_EMOJI[content.format]}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[post.status]}`}>
                    {STATUS_LABELS[post.status]}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canPublish && (
                      <button
                        onClick={() => setSelectedPost(post)}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Send className="w-3 h-3" />
                        Publicar ahora
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedPost(post)}
                      className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                      title="Ver detalles"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Post Detail Modal ─────────────────────────────────── */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPost(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {selectedPost.social_account && (
                  <PlatformIcon
                    platform={selectedPost.social_account.platform}
                    size="sm"
                    className={
                      selectedPost.social_account.platform === "instagram" ? "text-pink-600" :
                      selectedPost.social_account.platform === "facebook" ? "text-blue-600" : "text-red-600"
                    }
                  />
                )}
                <div>
                  <p className="font-semibold text-sm">{selectedPost.social_account?.account_name ?? "Cuenta"}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(selectedPost.scheduled_at), "EEEE d 'de' MMMM · HH:mm", { locale: es })}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedPost(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status badge */}
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[selectedPost.status]}`}>
                {STATUS_LABELS[selectedPost.status]}
              </span>
              {selectedPost.generated_post?.format && (
                <span className="text-sm">{FORMAT_EMOJI[selectedPost.generated_post.format]}</span>
              )}
            </div>

            {/* Media preview */}
            {selectedPost.generated_post?.media_urls?.[0] && (
              <div className="rounded-xl overflow-hidden bg-muted max-h-48">
                {selectedPost.generated_post.media_urls[0].match(/\.(mp4|mov|webm)$/i) ? (
                  <video
                    src={selectedPost.generated_post.media_urls[0]}
                    className="w-full max-h-48 object-contain"
                    controls
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedPost.generated_post.media_urls[0]}
                    alt="Media"
                    className="w-full max-h-48 object-contain"
                  />
                )}
              </div>
            )}

            {/* Caption */}
            {selectedPost.generated_post?.caption && (
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Caption</p>
                <p className="text-sm line-clamp-3 whitespace-pre-wrap">{selectedPost.generated_post.caption}</p>
              </div>
            )}

            {/* Error message if failed */}
            {selectedPost.status === "failed" && selectedPost.error_message && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-medium text-red-700 mb-1">Error anterior</p>
                <p className="text-xs text-red-600">{selectedPost.error_message}</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-1">
              {canPublishNow ? (
                <button
                  onClick={() => publishPostNow(selectedPost)}
                  disabled={publishingNow}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {publishingNow
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />
                  }
                  Publicar ahora
                </button>
              ) : selectedPost.status === "published" ? (
                <div className="w-full flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 py-2.5 rounded-xl text-sm font-medium border border-emerald-200">
                  <CheckCircle className="w-4 h-4" />
                  Ya publicado
                </div>
              ) : (
                <div className="w-full flex items-center justify-center gap-2 bg-muted text-muted-foreground py-2.5 rounded-xl text-sm font-medium">
                  <Clock className="w-4 h-4" />
                  Publicándose...
                </div>
              )}

              <button
                onClick={() => deletePost(selectedPost)}
                disabled={deletingPost}
                className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {deletingPost
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />
                }
                Eliminar publicación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add-post Modal ────────────────────────────────────── */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Programar publicación</h3>
                <p className="text-xs text-muted-foreground capitalize">
                  {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
                </p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Cuenta *</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecciona una cuenta...</option>
                {accounts.filter((a) => a.is_active).map((a) => (
                  <option key={a.id} value={a.id}>{a.platform} — {a.account_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Hora</label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Modo de publicación</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPublishMode("auto")}
                  className={cn("py-2 rounded-lg border text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
                    publishMode === "auto" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-border")}
                >
                  <Send className="w-3 h-3" /> Automático
                </button>
                <button
                  type="button"
                  onClick={() => setPublishMode("approval")}
                  className={cn("py-2 rounded-lg border text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
                    publishMode === "approval" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-border")}
                >
                  <Clock className="w-3 h-3" /> Requiere aprobación
                </button>
              </div>
            </div>

            <div className="pt-1 space-y-2">
              <button
                type="button"
                onClick={savePost}
                disabled={saving || !selectedAccountId}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                Programar
              </button>
              <p className="text-xs text-center text-muted-foreground">
                Para asignar contenido IA ve a{" "}
                <Link href="/create/ai" className="text-indigo-600 hover:underline">Crear con IA</Link>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
