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

    // Debug: return raw profiles to diagnose
    if (allProfiles.length === 0) {
      // Try raw fetch to see actual response
      const raw = await fetch("https://api.postproxy.dev/api/profiles", {
        headers: { "Authorization": `Bearer ${process.env.POSTPROXY_API_KEY}`, "Content-Type": "application/json" },
      });
      const rawJson = await raw.json().catch(() => "parse error");
      return NextResponse.json({ error: "0 profiles", rawStatus: raw.status, rawJson, keySet: !!process.env.POSTPROXY_API_KEY });
    }

    // If groupId set, filter by it — otherwise import all Postproxy profiles
    const relevant = allProfiles.filter((p) =>
      POSTPROXY_PLATFORMS.includes(p.platform as SocialPlatform) &&
      (!groupId || p.profile_group_id === groupId)
    );

    if (relevant.length === 0) {
      return NextResponse.json({
        error: "No matching profiles",
        groupId,
        allProfiles: allProfiles.map(p => ({ id: p.id, platform: p.platform, group: p.profile_group_id })),
      });
    }

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

    return NextResponse.json({ saved, total: relevant.length, groupId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
