import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { initializeConnection, type PostproxyPlatform } from "@/lib/postproxy";
import { handleApiError } from "@/lib/utils/errors";

const SUPPORTED_PLATFORMS: PostproxyPlatform[] = ["facebook", "instagram", "linkedin", "tiktok"];

export async function GET(request: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const platform = searchParams.get("platform") as PostproxyPlatform;

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }

    if (!platform || !SUPPORTED_PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: "platform not supported" }, { status: 400 });
    }

    // Callback URL carries workspaceId and platform so we can save the account after OAuth
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/postproxy/callback?workspaceId=${workspaceId}&platform=${platform}`;

    const { url } = await initializeConnection(platform, redirectUrl);

    return NextResponse.redirect(url);
  } catch (error) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
