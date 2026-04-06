import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { initializeConnection, type PostproxyPlatform } from "@/lib/postproxy";


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

    // Get workspace's Postproxy group ID
    const supabase = await createClient();
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("postproxy_group_id")
      .eq("id", workspaceId)
      .single();

    if (!workspace?.postproxy_group_id) {
      return NextResponse.json({ error: "Workspace has no Postproxy group. Recrea el workspace." }, { status: 400 });
    }

    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/postproxy/callback?workspaceId=${workspaceId}&platform=${platform}`;
    const { url } = await initializeConnection(platform, redirectUrl, workspace.postproxy_group_id);

    return NextResponse.redirect(url);
  } catch (error) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
