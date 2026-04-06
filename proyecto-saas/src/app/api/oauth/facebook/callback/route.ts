import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { upsertSocialAccount } from "@/lib/supabase/queries/social-accounts";
import { ApiError } from "@/lib/utils/errors";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/accounts?error=${error}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/accounts?error=missing_params`
      );
    }

    let stateData: { workspaceId: string };
    try {
      stateData = JSON.parse(Buffer.from(state, "base64").toString());
    } catch {
      throw new ApiError("Invalid state", 400);
    }

    // Exchange code for access token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        new URLSearchParams({
          client_id: process.env.META_APP_ID!,
          client_secret: process.env.META_APP_SECRET!,
          redirect_uri: process.env.META_REDIRECT_URI!,
          code,
        })
    );
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new ApiError(tokenData.error.message, 400);

    const shortToken = tokenData.access_token;

    // Exchange for long-lived token
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: process.env.META_APP_ID!,
          client_secret: process.env.META_APP_SECRET!,
          fb_exchange_token: shortToken,
        })
    );
    const longTokenData = await longTokenRes.json();
    const longToken = longTokenData.access_token;

    // Fetch user's pages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${longToken}&fields=id,name,picture,access_token,instagram_business_account`
    );
    const pagesData = await pagesRes.json();

    const savedAccounts: string[] = [];

    for (const page of pagesData.data ?? []) {
      // Save Facebook Page
      await upsertSocialAccount(supabase, {
        workspace_id: stateData.workspaceId,
        platform: "facebook",
        platform_user_id: page.id,
        account_name: page.name,
        account_handle: null,
        avatar_url: page.picture?.data?.url ?? null,
        access_token: page.access_token,
        refresh_token: null,
        token_expires_at: null,
        scopes: [],
        is_active: true,
        auto_publish: false,
        last_synced_at: null,
        followers_count: 0,
        metadata: { page_id: page.id },
      });
      savedAccounts.push(page.id);

      // Check for linked Instagram Business account
      if (page.instagram_business_account?.id) {
        const igId = page.instagram_business_account.id;
        const igRes = await fetch(
          `https://graph.facebook.com/v19.0/${igId}?fields=id,name,username,profile_picture_url,followers_count&access_token=${page.access_token}`
        );
        const igData = await igRes.json();

        if (!igData.error) {
          await upsertSocialAccount(supabase, {
            workspace_id: stateData.workspaceId,
            platform: "instagram",
            platform_user_id: igId,
            account_name: igData.name ?? igData.username,
            account_handle: igData.username ?? null,
            avatar_url: igData.profile_picture_url ?? null,
            access_token: page.access_token,
            refresh_token: null,
            token_expires_at: null,
            scopes: [],
            is_active: true,
            auto_publish: false,
            last_synced_at: null,
            followers_count: igData.followers_count ?? 0,
            metadata: { page_id: page.id, instagram_id: igId },
          });
        }
      }
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/accounts?success=connected&count=${savedAccounts.length}`
    );
  } catch (error) {
    console.error("[Facebook OAuth Callback]", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/accounts?error=oauth_failed`
    );
  }
}
