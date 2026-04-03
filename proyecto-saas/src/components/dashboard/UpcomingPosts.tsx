import Link from "next/link";
import { formatRelative } from "@/lib/utils/dates";
import { STATUS_COLORS, STATUS_LABELS, FORMAT_EMOJI, PLATFORM_LABELS } from "@/lib/utils/platform";
import { PlatformIcon } from "@/components/accounts/PlatformIcon";
import type { ScheduledPost } from "@/types/database";
import { CalendarClock, ArrowRight } from "lucide-react";

interface UpcomingPostsProps {
  posts: ScheduledPost[];
}

export function UpcomingPosts({ posts }: UpcomingPostsProps) {
  if (posts.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-indigo-600" />
          Próximas publicaciones
        </h3>
        <div className="text-center py-8">
          <CalendarClock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay publicaciones programadas</p>
          <Link
            href="/create"
            className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
          >
            Crear contenido <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-indigo-600" />
          Próximas publicaciones
        </h3>
        <Link href="/calendar" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
          Ver todas <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-3">
        {posts.map((post) => {
          const account = post.social_account;
          const content = post.generated_post;
          return (
            <div key={post.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
              {account && (
                <div className="mt-0.5 flex-shrink-0">
                  <PlatformIcon platform={account.platform} size="sm" className={
                    account.platform === "instagram" ? "text-pink-600" :
                    account.platform === "facebook" ? "text-blue-600" : "text-red-600"
                  } />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {account && (
                    <span className="text-xs font-medium text-foreground">{account.account_name}</span>
                  )}
                  {content?.format && (
                    <span className="text-xs">{FORMAT_EMOJI[content.format]}</span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[post.status]}`}>
                    {STATUS_LABELS[post.status]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {content?.caption ?? "Sin caption"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatRelative(post.scheduled_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
