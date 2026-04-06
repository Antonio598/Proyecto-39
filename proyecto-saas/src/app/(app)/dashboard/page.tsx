import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { UpcomingPosts } from "@/components/dashboard/UpcomingPosts";
import { AccountsOverview } from "@/components/dashboard/AccountsOverview";
import { listSocialAccounts } from "@/lib/supabase/queries/social-accounts";
import { getScheduledPosts, getPendingApprovals, getUpcomingPosts } from "@/lib/supabase/queries/posts";
import {
  LayoutDashboard, CheckSquare, Send, Link2, Users, TrendingUp,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard | ContentAI" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("workspace_id")?.value;
  if (!workspaceId) redirect("/workspace/new");

  // Parallel data fetching
  const [accounts, upcomingPosts, pendingPosts, publishedPosts] = await Promise.all([
    listSocialAccounts(supabase, workspaceId),
    getUpcomingPosts(supabase, workspaceId, 5),
    getPendingApprovals(supabase, workspaceId),
    getScheduledPosts(supabase, workspaceId, { status: "published", limit: 100 }),
  ]);

  const totalFollowers = accounts.reduce((sum, a) => sum + (a.followers_count ?? 0), 0);

  // Published this week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const publishedThisWeek = publishedPosts.filter(
    (p) => p.published_at && new Date(p.published_at) >= oneWeekAgo
  ).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6 text-indigo-600" />
          Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Vista general de tu actividad de contenido
        </p>
      </div>

      {/* Pending approvals banner */}
      {pendingPosts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {pendingPosts.length} publicación{pendingPosts.length > 1 ? "es" : ""} pendiente{pendingPosts.length > 1 ? "s" : ""} de aprobación
              </p>
              <p className="text-xs text-amber-600">Revisa y aprueba el contenido generado por IA</p>
            </div>
          </div>
          <Link
            href="/approval"
            className="flex-shrink-0 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
          >
            Revisar
          </Link>
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Cuentas conectadas"
          value={accounts.length}
          icon={Link2}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
          description={`${accounts.filter((a) => a.is_active).length} activas`}
        />
        <MetricCard
          title="Publicados esta semana"
          value={publishedThisWeek}
          icon={Send}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          trend="up"
          change="vs. semana pasada"
        />
        <MetricCard
          title="Pendientes de aprobación"
          value={pendingPosts.length}
          icon={CheckSquare}
          iconColor={pendingPosts.length > 0 ? "text-amber-600" : "text-gray-400"}
          iconBg={pendingPosts.length > 0 ? "bg-amber-50" : "bg-gray-50"}
          description={pendingPosts.length > 0 ? "Requieren tu revisión" : "Todo al día"}
        />
        <MetricCard
          title="Total seguidores"
          value={totalFollowers.toLocaleString()}
          icon={Users}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          description="Sumados de todas las cuentas"
        />
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingPosts posts={upcomingPosts} />
        <AccountsOverview accounts={accounts} />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/create/ai", label: "Generar con IA", emoji: "✨", color: "from-indigo-500 to-purple-600" },
          { href: "/calendar", label: "Ver calendario", emoji: "📅", color: "from-blue-500 to-cyan-600" },
          { href: "/automation/create", label: "Nueva regla", emoji: "⚡", color: "from-orange-500 to-red-500" },
          { href: "/workspace/integrations", label: "APIs de IA", emoji: "🔑", color: "from-violet-500 to-purple-700" },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`bg-gradient-to-br ${action.color} text-white rounded-xl p-4 text-center hover:opacity-90 transition-opacity group`}
          >
            <div className="text-2xl mb-1 group-hover:scale-110 transition-transform inline-block">
              {action.emoji}
            </div>
            <p className="text-sm font-medium">{action.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
