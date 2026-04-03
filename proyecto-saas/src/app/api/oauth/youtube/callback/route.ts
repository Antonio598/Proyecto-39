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

    const stateData: { workspaceId: string } = JSON.parse(
      Buffer.from(state, "base64").toString()
    );

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.YOUTUBE_REDIRECT_URI!,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new ApiError(tokenData.error_description, 400);

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Fetch channel info
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const channelData = await channelRes.json();
    const channel = channelData.items?.[0];

    if (!channel) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/accounts?error=no_channel`
      );
    }

    await upsertSocialAccount(supabase, {
      workspace_id: stateData.workspaceId,
      platform: "youtube",
      platform_user_id: channel.id,
      account_name: channel.snippet.title,
      account_handle: channel.snippet.customUrl ?? null,
      avatar_url: channel.snippet.thumbnails?.default?.url ?? null,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      token_expires_at: expiresAt,
      scopes: [],
      is_active: true,
      auto_publish: false,
      last_synced_at: null,
      followers_count: parseInt(channel.statistics?.subscriberCount ?? "0", 10),
      metadata: { channel_id: channel.id },
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/accounts?success=connected`
    );
  } catch (error) {
    console.error("[YouTube OAuth Callback]", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/accounts?error=oauth_failed`
    );
  }
}
