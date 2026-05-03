import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processKlingJob, type GeneratedPostRow } from "@/lib/ai/video-processor";

export const maxDuration = 300; // 5 min — FFmpeg concat + upload can take a while

// Runs every minute — finds all pending Kling video jobs and advances their
// state machine one step. Works even when the user has the page closed.
export async function GET(request: Request) {
  const cronSecret = request.headers.get("authorization");
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Find all pending Kling jobs (no media yet, created within 48h to skip dead jobs)
  // Use .cs("{}") — "contains empty set" is false for non-empty arrays, not what we want.
  // Safest approach: filter media_urls IS NULL or media_urls = '{}' using .or()
  const { data: posts, error } = await admin
    .from("generated_posts")
    .select("id, workspace_id, ai_provider, ai_job_id, media_urls, caption, hashtags, platform_data")
    .eq("ai_provider", "kling")
    .not("ai_job_id", "is", null)
    .or("media_urls.is.null,media_urls.eq.{}")
    .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .limit(5); // Cap per invocation — remaining jobs picked up next minute

  if (error) {
    console.error("[CronVideos] query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { postId: string; status: string; error?: string }[] = [];

  for (const post of posts ?? []) {
    try {
      // Get the Kling API key for this workspace
      const { data: brand } = await admin
        .from("brand_settings")
        .select("kling_key, nano_banana_key")
        .eq("workspace_id", post.workspace_id)
        .maybeSingle();

      if (!brand?.kling_key) {
        results.push({ postId: post.id, status: "skipped", error: "no kling_key" });
        continue;
      }

      const result = await processKlingJob(
        post as unknown as GeneratedPostRow,
        brand.kling_key,
        post.workspace_id,
        admin,
        brand.nano_banana_key ?? undefined,
      );

      console.log(`[CronVideos] post ${post.id} → ${result.status}`);
      results.push({
        postId: post.id,
        status: result.status,
        ...("error" in result ? { error: result.error } : {}),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[CronVideos] error processing ${post.id}:`, msg);
      results.push({ postId: post.id, status: "error", error: msg });
    }
  }

  return NextResponse.json({
    processed: results.length,
    completed: results.filter((r) => r.status === "completed").length,
    processing: results.filter((r) => r.status === "processing").length,
    failed: results.filter((r) => r.status === "failed" || r.status === "error").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    results,
  });
}
