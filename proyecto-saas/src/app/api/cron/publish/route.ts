import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishPost } from "@/lib/postproxy";

// Vercel Cron calls this every minute
export async function GET(request: Request) {
  const cronSecret = request.headers.get("authorization");
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const fiveMinutesAhead = new Date(now.getTime() + 5 * 60 * 1000);
  // Also pick up posts that were missed (up to 24 hours ago)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Find posts due to publish: either overdue (missed) or due in the next 5 minutes
  const { data: posts, error } = await supabase
    .from("scheduled_posts")
    .select("*, generated_post:generated_posts(*), social_account:social_accounts(*)")
    .in("status", ["approved", "scheduled"])
    .lte("scheduled_at", fiveMinutesAhead.toISOString())
    .gte("scheduled_at", oneDayAgo.toISOString())
    .lt("retry_count", 3);

  if (error) {
    console.error("[Cron Publish] Query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { postId: string; status: "published" | "failed"; error?: string }[] = [];

  for (const post of posts ?? []) {
    const account = post.social_account;
    const content = post.generated_post; // may be null for posts without AI content

    // Skip posts with no social account (data integrity issue)
    if (!account) {
      console.warn(`[Cron Publish] Post ${post.id} skipped: no social account linked`);
      continue;
    }

    // Mark as publishing
    await supabase
      .from("scheduled_posts")
      .update({ status: "publishing", updated_at: now.toISOString() })
      .eq("id", post.id);

    try {
      let platformPostId: string | null = null;

      // Build caption — only non-empty strings, avoid sending "" to platform APIs
      const rawCaption = [
        content?.caption ?? "",
        content?.hashtags?.join(" ") ?? "",
      ].filter(Boolean).join("\n\n");
      // Use undefined (not "") when there is no caption so APIs don't reject
      const caption = rawCaption.trim() || undefined;

      const mediaUrl = content?.media_urls?.[0] ?? null;

      const isPostproxyPlatform = ["facebook", "instagram", "linkedin", "tiktok", "youtube"].includes(account.platform);

      if (isPostproxyPlatform) {
        const profileId = account.metadata?.postproxy_profile_id;
        if (!profileId) {
          throw new Error(`La cuenta de ${account.platform} no está correctamente vinculada con PostProxy.`);
        }
        if (!mediaUrl && account.platform === "instagram") {
          throw new Error("Instagram requiere media (imagen o video) para publicar");
        }
        if (!mediaUrl && !caption && account.platform === "facebook") {
          throw new Error("Facebook requiere media o caption para publicar");
        }

        const isVid = mediaUrl ? /\.(mp4|mov|webm|m4v)(\?|$)/i.test(mediaUrl) : false;

        let mediaType: "REELS" | "STORY" | "FEED" = "FEED";
        if (content?.format === "reel" || (account.platform === "youtube" && isVid)) mediaType = "REELS";
        else if (content?.format === "story") mediaType = "STORY";

        // Resolve Facebook page_id from post platform_data or account metadata
        const facebookPageId =
          post.platform_data?.facebook_page_id as string | undefined
          ?? (account.platform === "facebook"
            ? (account.metadata?.facebook_pages as Array<{ id: string }> | undefined)?.[0]?.id
            : undefined);

        const r = await publishPost({
          body: caption ?? "",
          profiles: [profileId],
          mediaUrls: content?.media_urls?.length ? content.media_urls : (mediaUrl ? [mediaUrl] : undefined),
          mediaType,
          platform: account.platform,
          pageId: facebookPageId,
        });

        platformPostId = r?.id ?? r?.post_id ?? r?.data?.id ?? `postproxy-${Date.now()}`;
      }

      // Mark as published
      await supabase
        .from("scheduled_posts")
        .update({
          status: "published",
          published_at: now.toISOString(),
          platform_post_id: platformPostId,
          updated_at: now.toISOString(),
        })
        .eq("id", post.id);

      // Log activity
      await supabase.from("activity_logs").insert({
        workspace_id: post.workspace_id,
        action: "post.published",
        entity_type: "post",
        entity_id: post.id,
        metadata: { platform: account.platform, platformPostId },
      });

      results.push({ postId: post.id, status: "published" });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Cron Publish] Failed post ${post.id}:`, errorMsg);

      await supabase
        .from("scheduled_posts")
        .update({
          status: post.retry_count >= 2 ? "failed" : "approved",
          error_message: errorMsg,
          retry_count: (post.retry_count ?? 0) + 1,
          updated_at: now.toISOString(),
        })
        .eq("id", post.id);

      results.push({ postId: post.id, status: "failed", error: errorMsg });
    }
  }

  return NextResponse.json({
    processed: results.length,
    published: results.filter((r) => r.status === "published").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  });
}
