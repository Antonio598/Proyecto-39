"use client";

import { useWorkspace } from "@/providers/WorkspaceProvider";
import { PlatformIcon } from "@/components/accounts/PlatformIcon";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";

const PLATFORMS = [
  {
    id: "facebook",
    name: "Facebook",
    description: "Conecta tus Facebook Pages para publicar posts, reels y más.",
    color: "border-blue-200 hover:border-blue-400 hover:bg-blue-50",
    iconClass: "text-blue-600",
    features: ["Posts en páginas", "Reels", "Métricas"],
    via: "postproxy",
  },
  {
    id: "instagram",
    name: "Instagram",
    description: "Conecta tu cuenta de Instagram Business para publicar contenido.",
    color: "border-pink-200 hover:border-pink-400 hover:bg-pink-50",
    iconClass: "text-pink-600",
    features: ["Feed posts", "Reels", "Stories", "Carruseles"],
    via: "postproxy",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Publica en tu perfil o página de empresa de LinkedIn.",
    color: "border-sky-200 hover:border-sky-400 hover:bg-sky-50",
    iconClass: "text-sky-700",
    features: ["Posts de texto", "Imágenes", "Artículos", "Páginas de empresa"],
    via: "postproxy",
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "Conecta tu cuenta de TikTok para publicar videos automáticamente.",
    color: "border-gray-200 hover:border-gray-400 hover:bg-gray-50",
    iconClass: "text-gray-900",
    features: ["Videos", "TikTok Stories", "Programación"],
    via: "postproxy",
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "Conecta tu canal de YouTube para publicar Shorts y videos largos.",
    color: "border-red-200 hover:border-red-400 hover:bg-red-50",
    iconClass: "text-red-600",
    features: ["YouTube Shorts", "Videos largos", "Miniaturas automáticas"],
    via: "google",
  },
];

export default function ConnectAccountPage() {
  const { activeWorkspaceId } = useWorkspace();

  function handleConnect(platform: string, via: string) {
    if (!activeWorkspaceId) return;
    let endpoint = "";
    if (via === "postproxy") {
      endpoint = `/api/oauth/postproxy?workspaceId=${activeWorkspaceId}&platform=${platform}`;
    } else {
      endpoint = `/api/oauth/youtube?workspaceId=${activeWorkspaceId}`;
    }
    window.location.href = endpoint;
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
            onClick={() => handleConnect(platform.id, platform.via)}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white border flex items-center justify-center flex-shrink-0 shadow-sm">
                <PlatformIcon
                  platform={platform.id as "facebook" | "instagram" | "youtube" | "tiktok" | "linkedin"}
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
