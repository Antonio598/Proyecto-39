import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { listSocialAccounts } from "@/lib/supabase/queries/social-accounts";
import { PlatformIcon } from "@/components/accounts/PlatformIcon";
import { PLATFORM_LABELS, PLATFORM_BG_COLORS } from "@/lib/utils/platform";
import Link from "next/link";
import { Plus, Link2, RefreshCw, Settings } from "lucide-react";
import type { Metadata } from "next";
import type { SocialPlatform } from "@/types/database";
import { SyncAccountsButton } from "@/components/accounts/SyncAccountsButton";

export const metadata: Metadata = { title: "Cuentas sociales | ContentAI" };

const ALL_PLATFORMS: SocialPlatform[] = ["facebook", "instagram", "linkedin", "tiktok", "youtube"];

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("workspace_id")?.value;
  if (!workspaceId) redirect("/workspace/new");

  const accounts = await listSocialAccounts(supabase, workspaceId);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="w-6 h-6 text-indigo-600" />
            Cuentas sociales
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestiona las cuentas conectadas a este workspace
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncAccountsButton workspaceId={workspaceId} />
          <Link
            href="/accounts/connect"
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Conectar cuenta
          </Link>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white rounded-xl border p-16 text-center">
          <Link2 className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No hay cuentas conectadas</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            Conecta tus cuentas de redes sociales para empezar a publicar contenido automáticamente.
          </p>
          <Link
            href="/accounts/connect"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Conectar primera cuenta
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {ALL_PLATFORMS.map((platform) => {
            const platformAccounts = accounts.filter((a) => a.platform === platform);
            if (platformAccounts.length === 0) return null;

            return (
              <div key={platform} className="bg-white rounded-xl border p-5">
                <div className="flex items-center gap-2 mb-4">
                  <PlatformIcon platform={platform} size="md" />
                  <h3 className="font-semibold">{PLATFORM_LABELS[platform]}</h3>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    {platformAccounts.length} cuenta{platformAccounts.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="divide-y">
                  {platformAccounts.map((account) => (
                    <div key={account.id} className="py-3 flex items-center gap-4">
                      <div className="relative w-10 h-10 rounded-full bg-muted overflow-hidden flex-shrink-0">
                        {account.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={account.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground font-semibold text-sm">
                            {account.account_name[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                          account.is_active ? "bg-emerald-500" : "bg-gray-400"
                        }`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{account.account_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {account.account_handle ? `@${account.account_handle} · ` : ""}
                          {account.followers_count?.toLocaleString() ?? 0} seguidores
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${PLATFORM_BG_COLORS[platform]}`}>
                          {account.is_active ? "Activa" : "Inactiva"}
                        </span>
                        {account.auto_publish && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                            Auto-publicación
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Sincronizar">
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <Link
                          href={`/accounts/${account.id}/settings`}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="Configuración"
                        >
                          <Settings className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reconnect button */}
                <div className="mt-3 pt-3 border-t">
                  <Link
                    href={`/accounts/connect`}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Reconectar o agregar otra cuenta
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
