import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { handleApiError } from "@/lib/utils/errors";
import { processKlingJob, type GeneratedPostRow } from "@/lib/ai/video-processor";

export const maxDuration = 30;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const { jobId } = await params;
    const admin = createAdminClient();

    const { data: post } = await admin
      .from("generated_posts")
      .select("id, workspace_id, ai_provider, ai_job_id, caption, hashtags, media_urls, platform_data")
      .eq("workspace_id", workspaceId)
      .eq("ai_job_id", jobId)
      .single();

    if (!post) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Completed — media is ready
    if (post.media_urls?.length > 0) {
      return NextResponse.json({
        data: {
          status: "completed",
          progress: 100,
          result: {
            caption: post.caption,
            hashtags: post.hashtags,
            mediaUrls: post.media_urls,
            postId: post.id,
          },
          error: null,
        },
      });
    }

    const pd = post.platform_data as Record<string, unknown> | null;

    // Permanently failed
    if (pd?.job_failed) {
      return NextResponse.json({
        data: {
          status: "failed",
          progress: null,
          result: null,
          error: (pd.job_error as string | undefined) ?? "El video falló",
        },
      });
    }

    // Multi-clip: read-only — cron handles the FFmpeg concat step
    if (pd?.multi_clip) {
      const clipJobs = (pd.clip_jobs ?? []) as Array<{ scene: number; jobId: string | null; url: string | null }>;
      const completedCount = clipJobs.filter((j) => j.url).length;
      const progress = Math.min(completedCount * 33, 99);
      return NextResponse.json({
        data: { status: "processing", progress, result: null, error: null },
      });
    }

    // Single-clip: poll Kling now so the job advances while the user is on the page.
    // The cron (127.0.0.1:3000) handles it when the user is away.
    // Race condition is safe: both paths do the same idempotent DB write.
    const { data: brand } = await admin
      .from("brand_settings")
      .select("kling_key, nano_banana_key")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    await processKlingJob(
      post as unknown as GeneratedPostRow,
      brand?.kling_key ?? "",
      workspaceId,
      admin,
      brand?.nano_banana_key ?? undefined,
    ).catch(() => {});

    // Re-read to pick up any state the poll just wrote
    const { data: fresh } = await admin
      .from("generated_posts")
      .select("caption, hashtags, media_urls, platform_data, id")
      .eq("ai_job_id", jobId)
      .single();

    if (fresh && fresh.media_urls?.length > 0) {
      return NextResponse.json({
        data: {
          status: "completed",
          progress: 100,
          result: {
            caption: fresh.caption,
            hashtags: fresh.hashtags,
            mediaUrls: fresh.media_urls,
            postId: fresh.id,
          },
          error: null,
        },
      });
    }

    const freshPd = (fresh?.platform_data ?? null) as Record<string, unknown> | null;
    if (freshPd?.job_failed) {
      return NextResponse.json({
        data: {
          status: "failed",
          progress: null,
          result: null,
          error: (freshPd.job_error as string | undefined) ?? "El video falló",
        },
      });
    }

    return NextResponse.json({
      data: { status: "processing", progress: 30, result: null, error: null },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
