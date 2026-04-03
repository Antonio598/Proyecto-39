"use client";

import { createContext, useContext, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace.store";
import type { Workspace } from "@/types/database";

interface WorkspaceContextValue {
  activeWorkspaceId: string | null;
  workspaces: Workspace[];
  switchWorkspace: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  children,
  initialWorkspaces,
  initialActiveId,
}: {
  children: React.ReactNode;
  initialWorkspaces: Workspace[];
  initialActiveId?: string;
}) {
  const router = useRouter();
  const { activeWorkspaceId, setActiveWorkspace, setWorkspaces } =
    useWorkspaceStore();

  useEffect(() => {
    setWorkspaces(initialWorkspaces);
    if (
      initialActiveId &&
      (!activeWorkspaceId ||
        !initialWorkspaces.find((w) => w.id === activeWorkspaceId))
    ) {
      setActiveWorkspace(initialActiveId);
    }
  }, [initialWorkspaces, initialActiveId, activeWorkspaceId, setActiveWorkspace, setWorkspaces]);

  // Sync workspace cookie whenever it changes
  useEffect(() => {
    if (activeWorkspaceId) {
      document.cookie = `workspace_id=${activeWorkspaceId}; path=/; max-age=2592000`; // 30 days
    }
  }, [activeWorkspaceId]);

  const switchWorkspace = useCallback(
    (id: string) => {
      setActiveWorkspace(id);
      document.cookie = `workspace_id=${id}; path=/; max-age=2592000`;
      router.refresh();
    },
    [setActiveWorkspace, router]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        activeWorkspaceId,
        workspaces: initialWorkspaces,
        switchWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
