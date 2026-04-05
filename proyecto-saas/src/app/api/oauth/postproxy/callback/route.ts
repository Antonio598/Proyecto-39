import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfiles } from "@/lib/postproxy";
import { upsertSocialAccount } from "@/lib/supabase/queries/social-accounts";

export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(`${appUrl}/login`);

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const platform = searchParams.get("platform");
    const error = searchParams.get("error");

    if (error) return NextResponse.redirect(`${appUrl}/accounts?error=${error}`);
    if (!workspaceId || !platform) return NextResponse.redirect(`${appUrl}/accounts?error=missing_params`);

    // Get workspace's postproxy_group_id
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("postproxy_group_id")
      .eq("id", workspaceId)
      .single();

    const groupId = workspace?.postproxy_group_id;

    // Fetch profiles for this workspace's group
    const allProfiles = await getProfiles(groupId ?? undefined);
    const platformProfiles = allProfiles.filter((p) => p.platform === platform);

    let saved = 0;
    for (const profile of platformProfiles) {
      await upsertSocialAccount(supabase, {
        workspace_id: workspaceId,
        platform: platform as "facebook" | "instagram" | "linkedin" | "tiktok",
        platform_user_id: profile.id,
        account_name: profile.name,
        account_handle: null,
        avatar_url: profile.avatar_url ?? null,
        access_token: profile.id,
        refresh_token: null,
        token_expires_at: null,
        scopes: [],
        is_active: true,
        auto_publish: false,
        last_synced_at: new Date().toISOString(),
        followers_count: profile.followers_count ?? 0,
        metadata: { postproxy_profile_id: profile.id, postproxy_group_id: groupId },
      });
      saved++;
    }

    return NextResponse.redirect(`${appUrl}/accounts?success=connected&count=${saved}`);
  } catch (error) {
    console.error("[Postproxy Callback]", error);
    return NextResponse.redirect(`${appUrl}/accounts?error=oauth_failed`);
  }
}
