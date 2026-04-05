import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NewWorkspaceClient } from "./NewWorkspaceClient";

export default async function NewWorkspacePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch existing workspaces the user belongs to
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(id, name)")
    .eq("user_id", user.id);

  const existingWorkspaces = (memberships ?? [])
    .map((m) => {
      const ws = m.workspaces as { id: string; name: string } | null;
      return ws ? { id: ws.id, name: ws.name, role: m.role } : null;
    })
    .filter(Boolean) as { id: string; name: string; role: string }[];

  return <NewWorkspaceClient existingWorkspaces={existingWorkspaces} />;
}
