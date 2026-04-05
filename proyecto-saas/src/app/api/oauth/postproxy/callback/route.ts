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

    if (error) {
      return NextResponse.redirect(`${appUrl}/accounts?error=${error}`);
    }

    if (!workspaceId || !platform) {
      return NextResponse.redirect(`${appUrl}/accounts?error=missing_params`);
    }

    // Fetch all profiles from Postproxy and find the ones for this platform
    const profiles = await getProfiles();
    const platformProfiles = profiles.filter((p) => p.platform === platform);

    let saved = 0;
    for (const profile of platformProfiles) {
      await upsertSocialAccount(supabase, {
        workspace_id: workspaceId,
        platform: platform as "facebook" | "instagram" | "linkedin" | "tiktok",
        platform_user_id: profile.id,
        account_name: profile.display_name ?? profile.username,
        account_handle: profile.username ?? null,
        avatar_url: profile.avatar_url ?? null,
        access_token: profile.id, // We store the Postproxy profile ID as the token
        refresh_token: null,
        token_expires_at: null,
        scopes: [],
        is_active: true,
        auto_publish: false,
        last_synced_at: new Date().toISOString(),
        followers_count: profile.followers_count ?? 0,
        metadata: { postproxy_profile_id: profile.id, platform },
      });
      saved++;
    }

    return NextResponse.redirect(
      `${appUrl}/accounts?success=connected&count=${saved}`
    );
  } catch (error) {
    console.error("[Postproxy Callback]", error);
    return NextResponse.redirect(`${appUrl}/accounts?error=oauth_failed`);
  }
}
