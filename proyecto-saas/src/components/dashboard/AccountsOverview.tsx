import Link from "next/link";
import { PlatformIcon } from "@/components/accounts/PlatformIcon";
import { PLATFORM_LABELS } from "@/lib/utils/platform";
import type { SocialAccount } from "@/types/database";
import { Link2, ArrowRight, Plus } from "lucide-react";

interface AccountsOverviewProps {
  accounts: SocialAccount[];
}

export function AccountsOverview({ accounts }: AccountsOverviewProps) {
  if (accounts.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
          <Link2 className="w-4 h-4 text-indigo-600" />
          Cuentas conectadas
        </h3>
        <div className="text-center py-6">
          <Link2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No hay cuentas conectadas</p>
          <Link
            href="/accounts/connect"
            className="inline-flex items-center gap-1.5 text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Conectar cuenta
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Link2 className="w-4 h-4 text-indigo-600" />
          Cuentas conectadas
        </h3>
        <Link href="/accounts" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
          Ver todas <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {accounts.slice(0, 5).map((account) => (
          <div key={account.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/40 transition-colors">
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {account.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={account.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <PlatformIcon
                    platform={account.platform}
                    size="sm"
                    className={
                      account.platform === "instagram" ? "text-pink-600" :
                      account.platform === "facebook" ? "text-blue-600" : "text-red-600"
                    }
                  />
                )}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                account.is_active ? "bg-emerald-500" : "bg-gray-300"
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{account.account_name}</p>
              <p className="text-xs text-muted-foreground">
                {PLATFORM_LABELS[account.platform]} · {account.followers_count.toLocaleString()} seguidores
              </p>
            </div>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              account.auto_publish ? "bg-indigo-400" : "bg-gray-200"
            }`} title={account.auto_publish ? "Automatización activa" : "Modo manual"} />
          </div>
        ))}
      </div>

      <Link
        href="/accounts/connect"
        className="mt-3 flex items-center gap-2 p-2.5 rounded-lg border border-dashed border-border text-muted-foreground hover:border-indigo-300 hover:text-indigo-600 transition-colors text-sm"
      >
        <Plus className="w-4 h-4" />
        Conectar nueva cuenta
      </Link>
    </div>
  );
}
