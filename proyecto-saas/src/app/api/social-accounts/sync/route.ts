import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { getProfiles } from "@/lib/postproxy";
import { handleApiError } from "@/lib/utils/errors";
import type { SocialPlatform } from "@/types/database";

const POSTPROXY_PLATFORMS: SocialPlatform[] = ["facebook", "instagram", "linkedin", "tiktok"];

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const supabase = await createClient();
    const admin = createAdminClient();

    // Get workspace's postproxy group (may be null if column not yet added)
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("postproxy_group_id")
      .eq("id", workspaceId)
      .single();

    const groupId = (workspace as { postproxy_group_id?: string } | null)?.postproxy_group_id ?? null;

    const allProfiles = await getProfiles();

    // If groupId set, filter by it — otherwise import all Postproxy profiles
    const relevant = allProfiles.filter((p) =>
      POSTPROXY_PLATFORMS.includes(p.platform as SocialPlatform) &&
      (!groupId || p.profile_group_id === groupId)
    );

    let saved = 0;
    for (const profile of relevant) {
      const { error } = await admin.from("social_accounts").upsert({
        workspace_id: workspaceId,
        platform: profile.platform,
        platform_user_id: profile.id,
        account_name: profile.name,
        account_handle: null,
        avatar_url: profile.avatar_url ?? null,
        access_token: profile.id,
        refresh_token: null,
        token_expires_at: null,
        scopes: [],
        is_active: profile.status === "active",
        auto_publish: false,
        last_synced_at: new Date().toISOString(),
        followers_count: profile.followers_count ?? 0,
        metadata: { postproxy_profile_id: profile.id, postproxy_group_id: profile.profile_group_id },
        updated_at: new Date().toISOString(),
      }, { onConflict: "workspace_id,platform,platform_user_id" });

      if (!error) saved++;
      else console.error("[Sync] upsert error", error.message);
    }

    return NextResponse.json({ saved });
  } catch (error) {
    return handleApiError(error);
  }
}
