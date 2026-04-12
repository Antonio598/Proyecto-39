import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Debug endpoint: publishes a minimal test post to Facebook via Postproxy
// GET /api/social-accounts/facebook-debug?workspaceId=xxx&pageId=yyy
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  const pageId = searchParams.get("pageId");

  const key = process.env.POSTPROXY_API_KEY;
  if (!key) return NextResponse.json({ error: "No POSTPROXY_API_KEY" }, { status: 500 });

  // Get the Facebook social account for this workspace
  const admin = createAdminClient();
  const { data: accounts } = await admin
    .from("social_accounts")
    .select("*")
    .eq("workspace_id", workspaceId ?? "")
    .eq("platform", "facebook");

  const account = accounts?.[0];
  const profileId = (account?.metadata as Record<string, string> | null)?.postproxy_profile_id;

  // Build the exact same payload our publish route sends
  const payload = {
    post: { body: "Test post desde Postproxy debug — puedes eliminarlo" },
    profiles: profileId ? [profileId] : [],
    platforms: {
      facebook: {
        format: "post",
        ...(pageId && { page_id: pageId }),
      },
    },
  };

  const res = await fetch("https://api.postproxy.dev/api/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await res.text();
  let responseJson: unknown;
  try { responseJson = JSON.parse(responseText); } catch { responseJson = responseText; }

  return NextResponse.json({
    status: res.status,
    ok: res.ok,
    payloadSent: payload,
    account: account ? {
      id: account.id,
      name: account.account_name,
      profileId,
      pages: (account.metadata as Record<string, unknown> | null)?.facebook_pages,
    } : null,
    postproxyResponse: responseJson,
  });
}
