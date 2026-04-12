import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Debug endpoint: publishes a minimal test post to Facebook via Postproxy
// GET /api/social-accounts/facebook-debug?workspaceId=xxx&pageId=yyy
// GET /api/social-accounts/facebook-debug?checkId=postproxy_post_id  (check status)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  const pageId = searchParams.get("pageId");
  const checkId = searchParams.get("checkId");
  const key = process.env.POSTPROXY_API_KEY;
  if (!key) return NextResponse.json({ error: "No POSTPROXY_API_KEY" }, { status: 500 });

  // If checkId provided, just fetch that post's status from Postproxy
  if (checkId) {
    const res = await fetch(`https://api.postproxy.dev/api/posts/${checkId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const json = await res.json();
    return NextResponse.json({ status: res.status, postproxyPost: json });
  }

  // If no pageId, return full profile details to discover available pages
  if (!pageId) {
    const admin = createAdminClient();
    const { data: accounts } = await admin
      .from("social_accounts")
      .select("*")
      .eq("platform", "facebook");
    const account = accounts?.[0];
    const profileId = (account?.metadata as Record<string, string> | null)?.postproxy_profile_id;
    if (!profileId) return NextResponse.json({ error: "No Facebook profile found", accounts });

    const res = await fetch(`https://api.postproxy.dev/api/profiles/${profileId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const json = await res.json();
    return NextResponse.json({ profileId, profileDetails: json });
  }

  // Get ALL Facebook social accounts (no workspace filter) to find the profile ID
  const admin = createAdminClient();
  const { data: accounts } = await admin
    .from("social_accounts")
    .select("*")
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
