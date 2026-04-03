"use client";

import { useWorkspace } from "@/providers/WorkspaceProvider";
import { PlatformIcon } from "@/components/accounts/PlatformIcon";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";

const PLATFORMS = [
  {
    id: "facebook",
    name: "Facebook + Instagram",
    description: "Conecta tus Facebook Pages e Instagram Business accounts. Soporta múltiples páginas y cuentas en una sola conexión.",
    color: "border-blue-200 hover:border-blue-400 hover:bg-blue-50",
    iconClass: "text-blue-600",
    features: ["Posts en páginas", "Reels de Instagram", "Stories", "Carruseles", "Métricas e insights"],
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "Conecta tu canal de YouTube para publicar Shorts y videos largos automáticamente.",
    color: "border-red-200 hover:border-red-400 hover:bg-red-50",
    iconClass: "text-red-600",
    features: ["YouTube Shorts", "Videos largos", "Miniaturas automáticas", "Programación de publicación"],
  },
];

export default function ConnectAccountPage() {
  const { activeWorkspaceId } = useWorkspace();

  function handleConnect(platform: string) {
    if (!activeWorkspaceId) return;
    const endpoint = platform === "youtube" ? "/api/oauth/youtube" : "/api/oauth/facebook";
    window.location.href = `${endpoint}?workspaceId=${activeWorkspaceId}`;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a cuentas
        </Link>
        <h1 className="text-2xl font-bold">Conectar nueva cuenta</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Selecciona la red social que deseas conectar
        </p>
      </div>

      <div className="space-y-4">
        {PLATFORMS.map((platform) => (
          <div
            key={platform.id}
            className={`bg-white rounded-xl border-2 p-6 cursor-pointer transition-all ${platform.color}`}
            onClick={() => handleConnect(platform.id)}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white border flex items-center justify-center flex-shrink-0 shadow-sm">
                <PlatformIcon
                  platform={platform.id === "facebook" ? "facebook" : "youtube"}
                  size="lg"
                  className={platform.iconClass}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">{platform.name}</h3>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mt-1">{platform.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {platform.features.map((feature) => (
                    <span
                      key={feature}
                      className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">¿Por qué necesitamos permisos?</p>
        <p className="text-blue-600">
          Solo solicitamos los permisos necesarios para publicar contenido en tu nombre.
          Nunca accedemos a tu contraseña y puedes desconectar tu cuenta en cualquier momento.
        </p>
      </div>
    </div>
  );
}
