import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Called weekly by Vercel Cron to refresh expiring OAuth tokens
export async function GET(request: Request) {
  const cronSecret = request.headers.get("authorization");
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Find YouTube tokens expiring in the next 7 days
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const { data: accounts } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("platform", "youtube")
    .not("refresh_token", "is", null)
    .lte("token_expires_at", sevenDaysFromNow.toISOString());

  let refreshed = 0;

  for (const account of accounts ?? []) {
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: account.refresh_token!,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.error) continue;

      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

      await supabase
        .from("social_accounts")
        .update({
          access_token: tokenData.access_token,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);

      refreshed++;
    } catch (err) {
      console.error(`[Refresh Tokens] Failed for account ${account.id}:`, err);
    }
  }

  return NextResponse.json({ refreshed });
}
