import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(`${appUrl}/login`);

    const { searchParams } = new URL(request.url);

    // Log all params Postproxy sends back
    const allParams: Record<string, string> = {};
    searchParams.forEach((v, k) => { allParams[k] = v; });
    console.log("[Postproxy Callback] params:", JSON.stringify(allParams));

    const workspaceId = searchParams.get("workspaceId");
    const platform = searchParams.get("platform");
    const error = searchParams.get("error");

    // Postproxy may send profile_id or id directly in the callback
    const profileId = searchParams.get("profile_id") ?? searchParams.get("id") ?? searchParams.get("profile");

    if (error) return NextResponse.redirect(`${appUrl}/accounts?error=${error}`);
    if (!workspaceId || !platform) return NextResponse.redirect(`${appUrl}/accounts?error=missing_params`);

    const admin = createAdminClient();

    // Get workspace's postproxy group
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("postproxy_group_id, name")
      .eq("id", workspaceId)
      .single();

    const groupId = (workspace as { postproxy_group_id?: string; name?: string } | null)?.postproxy_group_id;

    let saved = 0;

    if (profileId) {
      // Postproxy sent the profile ID directly — save it
      await admin.from("social_accounts").upsert({
        workspace_id: workspaceId,
        platform,
        platform_user_id: profileId,
        account_name: platform.charAt(0).toUpperCase() + platform.slice(1),
        account_handle: null,
        avatar_url: null,
        access_token: profileId,
        refresh_token: null,
        token_expires_at: null,
        scopes: [],
        is_active: true,
        auto_publish: false,
        last_synced_at: new Date().toISOString(),
        followers_count: 0,
        metadata: { postproxy_profile_id: profileId, postproxy_group_id: groupId, all_params: allParams },
        updated_at: new Date().toISOString(),
      }, { onConflict: "workspace_id,platform,platform_user_id" });
      saved = 1;
    } else {
      // Try fetching profiles directly from Postproxy for this group
      const APIKEY = process.env.POSTPROXY_API_KEY!;
      const groups = groupId ? [groupId] : ["q2gFbR", "zVOFyO"];

      for (const gid of groups) {
        const res = await fetch(`https://api.postproxy.dev/api/profiles?profile_group_id=${gid}`, {
          headers: { "Authorization": `Bearer ${APIKEY}` },
        });
        const json = await res.json();
        const profiles: Array<{ id: string; name: string; platform: string; status?: string }> = json.data ?? [];
        const matching = profiles.filter((p) => p.platform === platform);

        for (const profile of matching) {
          await admin.from("social_accounts").upsert({
            workspace_id: workspaceId,
            platform,
            platform_user_id: profile.id,
            account_name: profile.name,
            account_handle: null,
            avatar_url: null,
            access_token: profile.id,
            refresh_token: null,
            token_expires_at: null,
            scopes: [],
            is_active: true,
            auto_publish: false,
            last_synced_at: new Date().toISOString(),
            followers_count: 0,
            metadata: { postproxy_profile_id: profile.id, postproxy_group_id: gid },
            updated_at: new Date().toISOString(),
          }, { onConflict: "workspace_id,platform,platform_user_id" });
          saved++;
        }
      }

      // If still nothing, save a placeholder so the user sees feedback
      if (saved === 0) {
        const placeholderId = `${platform}_${groupId ?? "default"}_${Date.now()}`;
        await admin.from("social_accounts").upsert({
          workspace_id: workspaceId,
          platform,
          platform_user_id: placeholderId,
          account_name: platform.charAt(0).toUpperCase() + platform.slice(1),
          account_handle: null,
          avatar_url: null,
          access_token: placeholderId,
          refresh_token: null,
          token_expires_at: null,
          scopes: [],
          is_active: true,
          auto_publish: false,
          last_synced_at: new Date().toISOString(),
          followers_count: 0,
          metadata: { postproxy_group_id: groupId, pending_sync: true, all_params: allParams },
          updated_at: new Date().toISOString(),
        }, { onConflict: "workspace_id,platform,platform_user_id" });
        saved = 1;
      }
    }

    return NextResponse.redirect(`${appUrl}/accounts?success=connected&count=${saved}`);
  } catch (error) {
    console.error("[Postproxy Callback]", error);
    return NextResponse.redirect(`${appUrl}/accounts?error=oauth_failed`);
  }
}
