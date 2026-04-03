import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { WorkspaceProvider } from "@/providers/WorkspaceProvider";
import { listUserWorkspaces } from "@/lib/supabase/queries/workspaces";
import { getPendingApprovals } from "@/lib/supabase/queries/posts";
import { cookies } from "next/headers";
import type { User } from "@/types/database";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch user profile
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  const appUser: User = profile ?? {
    id: user.id,
    email: user.email ?? "",
    full_name: user.user_metadata?.full_name ?? null,
    avatar_url: user.user_metadata?.avatar_url ?? null,
    created_at: user.created_at,
  };

  // Fetch workspaces
  const workspaces = await listUserWorkspaces(supabase, user.id);

  if (workspaces.length === 0) {
    redirect("/workspace/new");
  }

  // Determine active workspace from cookie
  const cookieStore = await cookies();
  const cookieWsId = cookieStore.get("workspace_id")?.value;
  const activeWorkspaceId =
    (cookieWsId && workspaces.find((w) => w.id === cookieWsId)?.id) ??
    workspaces[0].id;

  // Fetch pending approvals count
  let pendingCount = 0;
  try {
    const pending = await getPendingApprovals(supabase, activeWorkspaceId);
    pendingCount = pending.length;
  } catch {}

  return (
    <WorkspaceProvider
      initialWorkspaces={workspaces}
      initialActiveId={activeWorkspaceId}
    >
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar pendingApprovals={pendingCount} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar user={appUser} />
          <main className="flex-1 overflow-y-auto">
            <div className="p-6">{children}</div>
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
