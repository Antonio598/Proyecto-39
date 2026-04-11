"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Trash2, Loader2, RefreshCw, Plus, X } from "lucide-react";
import { PlatformIcon } from "@/components/accounts/PlatformIcon";
import { PLATFORM_LABELS } from "@/lib/utils/platform";
import { toast } from "sonner";
import Link from "next/link";
import type { SocialAccount } from "@/types/database";

interface FacebookPage {
  id: string;
  name: string;
}

function getFacebookPages(account: SocialAccount): FacebookPage[] {
  const meta = account.metadata as Record<string, unknown> | null;
  const pages = meta?.facebook_pages;
  if (!Array.isArray(pages)) return [];
  return pages as FacebookPage[];
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const { accountId } = useParams<{ accountId: string }>();
  const [account, setAccount] = useState<SocialAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [autoPublish, setAutoPublish] = useState(false);
  const [saving, setSaving] = useState(false);

  // Facebook pages state
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [newPageId, setNewPageId] = useState("");
  const [newPageName, setNewPageName] = useState("");
  const [savingPages, setSavingPages] = useState(false);

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
        if (data) setPages(getFacebookPages(data));
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

  async function savePages(updatedPages: FacebookPage[]) {
    setSavingPages(true);
    const currentMeta = (account?.metadata as Record<string, unknown>) ?? {};
    const res = await fetch(`/api/social-accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metadata: { ...currentMeta, facebook_pages: updatedPages },
      }),
    });
    if (res.ok) {
      const { data } = await res.json();
      setAccount(data);
      setPages(getFacebookPages(data));
      toast.success("Páginas guardadas");
    } else {
      toast.error("Error al guardar páginas");
    }
    setSavingPages(false);
  }

  function addPage() {
    const trimId = newPageId.trim();
    const trimName = newPageName.trim();
    if (!trimId || !trimName) { toast.error("Completa el ID y el nombre de la página"); return; }
    if (pages.some((p) => p.id === trimId)) { toast.error("Esa página ya está agregada"); return; }
    const updated = [...pages, { id: trimId, name: trimName }];
    setNewPageId("");
    setNewPageName("");
    savePages(updated);
  }

  function removePage(pageId: string) {
    const updated = pages.filter((p) => p.id !== pageId);
    savePages(updated);
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

      {/* Facebook Pages */}
      {account.platform === "facebook" && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <div>
            <h2 className="font-semibold">Páginas de Facebook</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Agrega las páginas a las que quieres publicar. El ID lo encuentras en la URL de tu página de Facebook.
            </p>
          </div>

          {/* Existing pages */}
          {pages.length > 0 && (
            <div className="space-y-2">
              {pages.map((page) => (
                <div key={page.id} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-blue-900">{page.name}</p>
                    <p className="text-xs text-blue-600 font-mono">ID: {page.id}</p>
                  </div>
                  <button
                    onClick={() => removePage(page.id)}
                    disabled={savingPages}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Eliminar página"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new page form */}
          <div className="border border-dashed rounded-xl p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Agregar página</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Nombre de la página"
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Page ID (ej. 61575740184936)"
                value={newPageId}
                onChange={(e) => setNewPageId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPage()}
                className="border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={addPage}
              disabled={savingPages || !newPageId.trim() || !newPageName.trim()}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {savingPages ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Agregar página
            </button>
          </div>
        </div>
      )}

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
