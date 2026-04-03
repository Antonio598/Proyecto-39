import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { listSocialAccounts } from "@/lib/supabase/queries/social-accounts";
import { getScheduledPosts } from "@/lib/supabase/queries/posts";
import { PlatformIcon } from "@/components/accounts/PlatformIcon";
import { PLATFORM_LABELS } from "@/lib/utils/platform";
import { BarChart2, TrendingUp, Users, Send, CheckCircle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Analíticas | ContentAI" };

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("workspace_id")?.value;
  if (!workspaceId) redirect("/workspace/new");

  const [accounts, allPosts] = await Promise.all([
    listSocialAccounts(supabase, workspaceId),
    getScheduledPosts(supabase, workspaceId, { limit: 500 }),
  ]);

  const published = allPosts.filter((p) => p.status === "published");
  const failed = allPosts.filter((p) => p.status === "failed");
  const successRate = allPosts.length > 0
    ? Math.round((published.length / (published.length + failed.length || 1)) * 100)
    : 0;

  // Posts by platform
  const postsByPlatform = accounts.reduce((acc, account) => {
    const platformPosts = published.filter((p) => p.social_account_id === account.id);
    acc[account.id] = { account, count: platformPosts.length };
    return acc;
  }, {} as Record<string, { account: typeof accounts[0]; count: number }>);

  // Last 7 days activity
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    return d;
  }).reverse();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-indigo-600" />
          Analíticas
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Rendimiento de tu contenido</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total publicados", value: published.length, icon: Send, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Tasa de éxito", value: `${successRate}%`, icon: CheckCircle, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Total seguidores", value: accounts.reduce((s, a) => s + a.followers_count, 0).toLocaleString(), icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Cuentas activas", value: accounts.filter((a) => a.is_active).length, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border p-5 flex items-start gap-3">
            <div className={`p-2.5 rounded-lg flex-shrink-0 ${bg}`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold mt-0.5">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Performance by account */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">Publicaciones por cuenta</h3>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Conecta cuentas para ver estadísticas
          </p>
        ) : (
          <div className="space-y-3">
            {Object.values(postsByPlatform)
              .sort((a, b) => b.count - a.count)
              .map(({ account, count }) => {
                const maxCount = Math.max(...Object.values(postsByPlatform).map((v) => v.count), 1);
                const pct = Math.round((count / maxCount) * 100);

                return (
                  <div key={account.id} className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-44 min-w-0">
                      <PlatformIcon
                        platform={account.platform}
                        size="sm"
                        className={
                          account.platform === "instagram" ? "text-pink-600" :
                          account.platform === "facebook" ? "text-blue-600" : "text-red-600"
                        }
                      />
                      <span className="text-sm truncate">{account.account_name}</span>
                    </div>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="h-2 bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-16 text-right">{count} posts</span>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Insights note */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700">
        <p className="font-medium">Métricas detalladas próximamente</p>
        <p className="text-amber-600 mt-0.5 text-xs">
          Las métricas de alcance, impresiones y engagement se sincronizarán desde Meta Graph API y YouTube Analytics.
          Las API keys deben estar configuradas para habilitar esta función.
        </p>
      </div>
    </div>
  );
}
