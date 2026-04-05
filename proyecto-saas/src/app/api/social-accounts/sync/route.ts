import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { getProfiles } from "@/lib/postproxy";
import { upsertSocialAccount } from "@/lib/supabase/queries/social-accounts";
import { handleApiError } from "@/lib/utils/errors";
import type { SocialPlatform } from "@/types/database";

const POSTPROXY_PLATFORMS: SocialPlatform[] = ["facebook", "instagram", "linkedin", "tiktok"];

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const supabase = await createClient();

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("postproxy_group_id")
      .eq("id", workspaceId)
      .single();

    const groupId = workspace?.postproxy_group_id;
    const allProfiles = await getProfiles();

    // Filter by group if available, otherwise take all
    const relevant = allProfiles.filter((p) =>
      POSTPROXY_PLATFORMS.includes(p.platform as SocialPlatform) &&
      (!groupId || p.profile_group_id === groupId)
    );

    let saved = 0;
    for (const profile of relevant) {
      await upsertSocialAccount(supabase, {
        workspace_id: workspaceId,
        platform: profile.platform as SocialPlatform,
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
      });
      saved++;
    }

    return NextResponse.json({ saved });
  } catch (error) {
    return handleApiError(error);
  }
}
