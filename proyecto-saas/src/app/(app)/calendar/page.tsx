"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, Plus, List } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { STATUS_COLORS, STATUS_LABELS, FORMAT_EMOJI } from "@/lib/utils/platform";
import { PlatformIcon } from "@/components/accounts/PlatformIcon";
import { toast } from "sonner";
import Link from "next/link";
import type { ScheduledPost } from "@/types/database";

async function fetchPosts(workspaceId: string, from: string, to: string) {
  const params = new URLSearchParams({ from, to });
  const res = await fetch(`/api/posts?${params}`, {
    headers: { "x-workspace-id": workspaceId },
  });
  const json = await res.json();
  return (json.data ?? []) as ScheduledPost[];
}

function PostChip({ post }: { post: ScheduledPost }) {
  const account = post.social_account;
  const content = post.generated_post;
  return (
    <div className={cn(
      "text-xs px-1.5 py-0.5 rounded cursor-pointer truncate flex items-center gap-1",
      STATUS_COLORS[post.status]
    )}>
      {account && (
        <PlatformIcon platform={account.platform} size="sm" className="w-3 h-3 flex-shrink-0" />
      )}
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

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad to start on Monday
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
    queryFn: () =>
      fetchPosts(activeWorkspaceId!, monthStart.toISOString(), monthEnd.toISOString()),
    enabled: !!activeWorkspaceId,
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ postId, scheduledAt }: { postId: string; scheduledAt: string }) => {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspaceId!,
        },
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActivePost(null);

    if (!over || active.id === over.id) return;

    const postId = active.id as string;
    const targetDate = over.id as string;

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    // Keep original time, change date
    const originalTime = parseISO(post.scheduled_at);
    const newDate = new Date(targetDate);
    newDate.setHours(originalTime.getHours(), originalTime.getMinutes(), 0, 0);

    rescheduleMutation.mutate({ postId, scheduledAt: newDate.toISOString() });
  }

  function getPostsForDay(day: Date) {
    return posts.filter((p) => isSameDay(parseISO(p.scheduled_at), day));
  }

  const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            Calendario
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {posts.length} publicaciones este mes
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode("month")}
              className={cn("p-1.5 rounded-md text-sm transition-colors", viewMode === "month" ? "bg-white shadow-sm" : "text-muted-foreground")}
            >
              <Calendar className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn("p-1.5 rounded-md text-sm transition-colors", viewMode === "list" ? "bg-white shadow-sm" : "text-muted-foreground")}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold min-w-[140px] text-center capitalize">
              {format(currentDate, "MMMM yyyy", { locale: es })}
            </span>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-xs border rounded-lg hover:bg-muted transition-colors"
          >
            Hoy
          </button>

          <Link
            href="/create/ai"
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Crear
          </Link>
        </div>
      </div>

      {viewMode === "month" ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="bg-white rounded-xl border overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b">
              {DAY_NAMES.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground border-r last:border-0">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {paddedDays.map((day) => {
                const dayPosts = getPostsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isDayToday = isToday(day);

                return (
                  <div
                    key={day.toISOString()}
                    id={day.toISOString().split("T")[0]}
                    className={cn(
                      "min-h-[100px] p-1.5 border-r border-b last:border-r-0 transition-colors",
                      !isCurrentMonth && "bg-muted/30",
                      isDayToday && "bg-indigo-50/50"
                    )}
                  >
                    <div className={cn(
                      "text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                      isDayToday ? "bg-indigo-600 text-white" : isCurrentMonth ? "text-foreground" : "text-muted-foreground/50"
                    )}>
                      {format(day, "d")}
                    </div>

                    <div className="space-y-0.5">
                      {dayPosts.slice(0, 3).map((post) => (
                        <PostChip key={post.id} post={post} />
                      ))}
                      {dayPosts.length > 3 && (
                        <div className="text-xs text-muted-foreground pl-1">
                          +{dayPosts.length - 3} más
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DragOverlay>
            {activePost && <PostChip post={activePost} />}
          </DragOverlay>
        </DndContext>
      ) : (
        /* List view */
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
                  {content?.format && (
                    <span className="text-sm">{FORMAT_EMOJI[content.format]}</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[post.status]}`}>
                    {STATUS_LABELS[post.status]}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
