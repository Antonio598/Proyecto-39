import type { SupabaseClient } from "@supabase/supabase-js";
import type { Workspace, WorkspaceMember } from "@/types/database";

export async function getWorkspace(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<Workspace | null> {
  const { data } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single();
  return data;
}

export async function listUserWorkspaces(
  supabase: SupabaseClient,
  userId: string
): Promise<Workspace[]> {
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace:workspaces(*)")
    .eq("user_id", userId)
    .not("accepted_at", "is", null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data?.map((m: any) => m.workspace) ?? []).filter(Boolean) as Workspace[];
}

export async function createWorkspace(
  supabase: SupabaseClient,
  data: { name: string; slug: string; timezone?: string; userId: string }
): Promise<Workspace> {
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .insert({
      name: data.name,
      slug: data.slug,
      timezone: data.timezone ?? "UTC",
      created_by: data.userId,
    })
    .select()
    .single();

  if (error) throw error;
  return workspace;
}

export async function listWorkspaceMembers(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<WorkspaceMember[]> {
  const { data } = await supabase
    .from("workspace_members")
    .select("*, user:users(*)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  return data ?? [];
}

export async function getUserRole(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();

  return data?.role ?? null;
}
