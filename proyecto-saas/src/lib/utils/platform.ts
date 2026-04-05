import type { SocialPlatform, PostFormat } from "@/types/database";

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

export const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  instagram: "#E1306C",
  facebook: "#1877F2",
  youtube: "#FF0000",
  linkedin: "#0A66C2",
  tiktok: "#000000",
};

export const PLATFORM_BG_COLORS: Record<SocialPlatform, string> = {
  instagram: "bg-pink-50 text-pink-700 border-pink-200",
  facebook: "bg-blue-50 text-blue-700 border-blue-200",
  youtube: "bg-red-50 text-red-700 border-red-200",
  linkedin: "bg-sky-50 text-sky-700 border-sky-200",
  tiktok: "bg-gray-50 text-gray-700 border-gray-200",
};

export const FORMAT_LABELS: Record<PostFormat, string> = {
  image: "Imagen",
  carousel: "Carrusel",
  reel: "Reel",
  story: "Story",
  short: "Short",
  long_video: "Video largo",
  text: "Texto",
};

export const FORMAT_EMOJI: Record<PostFormat, string> = {
  image: "🖼️",
  carousel: "📸",
  reel: "🎬",
  story: "⭕",
  short: "▶️",
  long_video: "🎥",
  text: "📝",
};

export const PLATFORM_FORMATS: Record<SocialPlatform, PostFormat[]> = {
  instagram: ["image", "carousel", "reel", "story"],
  facebook: ["image", "carousel", "text", "reel"],
  youtube: ["short", "long_video"],
  linkedin: ["image", "text", "carousel"],
  tiktok: ["reel", "short"],
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  generating: "Generando",
  pending_approval: "Pendiente aprobación",
  approved: "Aprobado",
  rejected: "Rechazado",
  scheduled: "Programado",
  publishing: "Publicando",
  published: "Publicado",
  failed: "Error",
};

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  generating: "bg-blue-100 text-blue-700 animate-pulse",
  pending_approval: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  scheduled: "bg-indigo-100 text-indigo-700",
  publishing: "bg-purple-100 text-purple-700 animate-pulse",
  published: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  editor: "Editor",
  client: "Cliente",
  team_member: "Miembro del equipo",
};

export const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
