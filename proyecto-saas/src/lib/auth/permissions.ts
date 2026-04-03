import type { WorkspaceRole } from "@/types/database";

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  admin: 4,
  editor: 3,
  team_member: 2,
  client: 1,
};

export function hasRole(
  userRole: WorkspaceRole,
  requiredRole: WorkspaceRole
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function canApproveContent(role: WorkspaceRole): boolean {
  return hasRole(role, "editor");
}

export function canManageAccounts(role: WorkspaceRole): boolean {
  return hasRole(role, "editor");
}

export function canManageMembers(role: WorkspaceRole): boolean {
  return hasRole(role, "admin");
}

export function canManageAutomation(role: WorkspaceRole): boolean {
  return hasRole(role, "editor");
}

export function canDeleteContent(role: WorkspaceRole): boolean {
  return hasRole(role, "editor");
}

export function canViewAnalytics(role: WorkspaceRole): boolean {
  return hasRole(role, "client");
}

export function canCreateContent(role: WorkspaceRole): boolean {
  return hasRole(role, "team_member");
}
