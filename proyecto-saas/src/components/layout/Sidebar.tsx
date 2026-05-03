"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { useUiStore } from "@/store/ui.store";
import {
  LayoutDashboard, Calendar, ImageIcon, Sparkles,
  CheckSquare, Zap, BarChart2, Palette, Settings,
  ChevronLeft, ChevronRight, Users, Link2, KeyRound, Activity,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendario", icon: Calendar },
  { href: "/create", label: "Crear contenido", icon: Sparkles },
  { href: "/approval", label: "Aprobaciones", icon: CheckSquare, badge: "pending" },
  { href: "/content", label: "Banco multimedia", icon: ImageIcon },
  { href: "/accounts", label: "Cuentas sociales", icon: Link2 },
  { href: "/automation", label: "Automatización", icon: Zap },
  { href: "/analytics", label: "Analíticas", icon: BarChart2 },
  { href: "/logs", label: "Registros", icon: Activity },
];

const BOTTOM_ITEMS = [
  { href: "/workspace/integrations", label: "APIs de IA", icon: KeyRound },
  { href: "/brand", label: "Kit de marca", icon: Palette },
  { href: "/workspace/members", label: "Equipo", icon: Users },
  { href: "/workspace/settings", label: "Configuración", icon: Settings },
];

interface SidebarProps {
  pendingApprovals?: number;
}

export function Sidebar({ pendingApprovals = 0 }: SidebarProps) {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar transition-all duration-200 ease-in-out",
        sidebarCollapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo + workspace switcher */}
      <div className="p-3 border-b border-sidebar-border">
        {sidebarCollapsed ? (
          <div className="flex justify-center py-1">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </div>
        ) : (
          <WorkspaceSwitcher />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          const showBadge = badge === "pending" && pendingApprovals > 0;

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                sidebarCollapsed && "justify-center px-2"
              )}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 truncate">{label}</span>
                  {showBadge && (
                    <span className="flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs rounded-full font-bold">
                      {pendingApprovals > 9 ? "9+" : pendingApprovals}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom nav */}
      <div className="p-2 border-t border-sidebar-border space-y-0.5">
        {BOTTOM_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground/80",
                sidebarCollapsed && "justify-center px-2"
              )}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className={cn(
            "flex items-center gap-3 px-2.5 py-2 w-full rounded-lg text-sm text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground/80 transition-colors",
            sidebarCollapsed && "justify-center px-2"
          )}
          title={sidebarCollapsed ? "Expandir" : "Colapsar"}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 flex-shrink-0" />
              <span>Colapsar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
