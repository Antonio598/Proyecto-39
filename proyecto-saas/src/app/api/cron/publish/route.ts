import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { InstagramPublisher } from "@/lib/social/meta/instagram";
import { FacebookPublisher } from "@/lib/social/meta/facebook";
import { YouTubePublisher } from "@/lib/social/youtube/upload";

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

      if (account.platform === "instagram") {
        const ig = new InstagramPublisher(account.access_token, account.platform_user_id);

        if (content?.format === "reel" && mediaUrl) {
          const r = await ig.publishReel(mediaUrl, caption ?? "");
          platformPostId = r.id;
        } else if (content?.format === "story" && mediaUrl) {
          const isVideo = mediaUrl.match(/\.(mp4|mov|webm)$/i) !== null;
          const r = await ig.publishStory(mediaUrl, isVideo);
          platformPostId = r.id;
        } else if (content?.format === "carousel" && content.media_urls?.length > 1) {
          const r = await ig.publishCarousel(content.media_urls, caption ?? "");
          platformPostId = r.id;
        } else if (mediaUrl) {
          const r = await ig.publishImage(mediaUrl, caption ?? "");
          platformPostId = r.id;
        } else if (caption) {
          // Text-only post if no media
          throw new Error("Instagram requires media — no media_url found");
        } else {
          throw new Error("Instagram post requires media and/or caption");
        }
      } else if (account.platform === "facebook") {
        const fb = new FacebookPublisher(account.access_token, account.metadata?.page_id ?? account.platform_user_id);

        if (mediaUrl && mediaUrl.match(/\.(mp4|mov|webm)$/i)) {
          const r = await fb.publishVideo(mediaUrl, content?.caption ?? "Video", caption ?? "");
          platformPostId = r.id;
        } else if (mediaUrl) {
          const r = await fb.publishPhoto(mediaUrl, caption ?? "");
          platformPostId = r.id;
        } else {
          const r = await fb.publishText(caption ?? "");
          platformPostId = r.id;
        }
      } else if (account.platform === "youtube" && mediaUrl) {
        const yt = new YouTubePublisher(account.access_token);
        const r = await yt.uploadVideoByUrl(mediaUrl, {
          title: content?.caption?.split("\n")[0]?.slice(0, 100) ?? "Video",
          description: caption ?? "",
          tags: content?.hashtags?.map((h: string) => h.replace("#", "")) ?? [],
          privacyStatus: "public",
        });
        platformPostId = r.id;
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
