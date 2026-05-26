import { createAdminClient } from "@/lib/supabase/admin";
import { processKlingJob, type GeneratedPostRow } from "@/lib/ai/video-processor";

export async function processVideoQueue(): Promise<void> {
  const admin = createAdminClient();

  const { data: posts, error } = await admin
    .from("generated_posts")
    .select("id, workspace_id, ai_provider, ai_job_id, media_urls, caption, hashtags, platform_data")
    .in("ai_provider", ["kling", "nano_banana"])
    .not("ai_job_id", "is", null)
    .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .limit(50);

  if (error) {
    console.error("[VideoQueue] query error:", error);
    return;
  }

  const pendingPosts = posts?.filter((p) => !p.media_urls || p.media_urls.length === 0) ?? [];

  for (const post of pendingPosts) {
    if ((post.platform_data as Record<string, unknown> | null)?.job_failed) continue;

    try {
      const { data: brand } = await admin
        .from("brand_settings")
        .select("kling_key, nano_banana_key")
        .eq("workspace_id", post.workspace_id)
        .maybeSingle();

      const needsKling = post.ai_provider === "kling";
      if (needsKling && !brand?.kling_key) continue;
      if (!needsKling && !brand?.nano_banana_key) continue;

      const result = await processKlingJob(
        post as unknown as GeneratedPostRow,
        brand?.kling_key ?? "",
        post.workspace_id,
        admin,
        brand?.nano_banana_key ?? undefined,
      );
      console.log(`[VideoQueue] post ${post.id} → ${result.status}`);
    } catch (err) {
      console.error(
        `[VideoQueue] error processing ${post.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}
