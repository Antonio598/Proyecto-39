import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/utils/errors";

export async function getSession() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    throw new ApiError("Unauthorized", 401, "UNAUTHORIZED");
  }
  return session;
}

export function getWorkspaceIdFromRequest(request: Request): string | null {
  return request.headers.get("x-workspace-id");
}

export async function requireWorkspaceAccess(request: Request) {
  const session = await requireAuth();
  const workspaceId = getWorkspaceIdFromRequest(request);

  if (!workspaceId) {
    throw new ApiError("Workspace ID required", 400, "WORKSPACE_REQUIRED");
  }

  return { session, workspaceId };
}
