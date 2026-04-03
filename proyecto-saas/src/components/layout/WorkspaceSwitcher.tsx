"use client";

import { useWorkspace } from "@/providers/WorkspaceProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronsUpDown, Plus, Check, Building2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export function WorkspaceSwitcher() {
  const { activeWorkspaceId, workspaces, switchWorkspace } = useWorkspace();
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/20 text-primary flex-shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium truncate">
              {activeWs?.name ?? "Seleccionar workspace"}
            </p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {activeWs?.plan === "free" ? "Plan gratuito" : activeWs?.plan ?? ""}
            </p>
          </div>
          <ChevronsUpDown className="w-4 h-4 text-sidebar-foreground/60 flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-60" align="start" side="right" sideOffset={8}>
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {workspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onClick={() => switchWorkspace(ws.id)}
            className="flex items-center gap-2"
          >
            <div className="flex items-center justify-center w-6 h-6 rounded bg-indigo-100 text-indigo-600 flex-shrink-0">
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <span className="flex-1 truncate text-sm">{ws.name}</span>
            {ws.id === activeWorkspaceId && (
              <Check className="w-4 h-4 text-indigo-600" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/workspace/new" className="flex items-center gap-2 cursor-pointer">
            <div className={cn(
              "flex items-center justify-center w-6 h-6 rounded border-2 border-dashed border-muted-foreground/40"
            )}>
              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <span className="text-sm">Nuevo workspace</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
