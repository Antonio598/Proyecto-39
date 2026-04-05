"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Trash2, Loader2, RefreshCw } from "lucide-react";
import { PlatformIcon } from "@/components/accounts/PlatformIcon";
import { PLATFORM_LABELS } from "@/lib/utils/platform";
import { toast } from "sonner";
import Link from "next/link";
import type { SocialAccount } from "@/types/database";

export default function AccountSettingsPage() {
  const router = useRouter();
  const { accountId } = useParams<{ accountId: string }>();
  const [account, setAccount] = useState<SocialAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [autoPublish, setAutoPublish] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("social_accounts")
      .select("*")
      .eq("id", accountId)
      .single()
      .then(({ data }) => {
        setAccount(data);
        setAutoPublish(data?.auto_publish ?? false);
        setLoading(false);
      });
  }, [accountId]);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/social-accounts/${accountId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Cuenta eliminada");
      router.push("/accounts");
      router.refresh();
    } else {
      toast.error("Error al eliminar");
      setDeleting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/social-accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto_publish: autoPublish }),
    });
    if (res.ok) toast.success("Guardado");
    else toast.error("Error al guardar");
    setSaving(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!account) return (
    <div className="text-center py-16 text-muted-foreground">
      Cuenta no encontrada.{" "}
      <Link href="/accounts" className="text-indigo-600 hover:underline">Volver</Link>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/accounts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver a cuentas
        </Link>
        <div className="flex items-center gap-3">
          <PlatformIcon platform={account.platform} size="lg" />
          <div>
            <h1 className="text-2xl font-bold">{account.account_name}</h1>
            <p className="text-sm text-muted-foreground">
              {PLATFORM_LABELS[account.platform]}
              {account.account_handle ? ` · @${account.account_handle}` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold">Estado de la conexión</h2>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${account.is_active ? "bg-emerald-500" : "bg-gray-400"}`} />
          <span className="text-sm">{account.is_active ? "Activa" : "Inactiva"}</span>
        </div>
        {account.last_synced_at && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Última sincronización: {new Date(account.last_synced_at).toLocaleString("es")}
          </p>
        )}
      </div>

      {/* Settings */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold">Configuración</h2>
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm font-medium">Auto-publicación</p>
            <p className="text-xs text-muted-foreground">Publicar automáticamente sin aprobación manual</p>
          </div>
          <button
            onClick={() => setAutoPublish(!autoPublish)}
            className={`relative w-11 h-6 rounded-full transition-colors ${autoPublish ? "bg-indigo-600" : "bg-gray-200"}`}
          >
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoPublish ? "translate-x-5" : ""}`} />
          </button>
        </label>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Guardar
        </button>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-xl border border-red-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide">Zona de peligro</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Desconectar cuenta</p>
            <p className="text-xs text-muted-foreground">Elimina esta cuenta del workspace.</p>
          </div>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 border border-red-300 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Eliminar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 font-medium">¿Seguro?</span>
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted">Cancelar</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-3 h-3 animate-spin" />}
                Confirmar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
