import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { handleApiError } from "@/lib/utils/errors";

export const maxDuration = 30;

// Read-only status endpoint — the cron job (/api/cron/process-videos) does all
// the actual processing. This endpoint just reads DB state so the browser can
// poll without racing against the background worker.
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
      .select("id, caption, hashtags, media_urls, platform_data")
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

    // Permanently failed — marked by background processor so cron stops retrying
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

    // Multi-clip: derive progress from clip_jobs array in platform_data
    if (pd?.multi_clip) {
      const clipJobs = (pd.clip_jobs ?? []) as Array<{ scene: number; jobId: string | null; url: string | null }>;
      const completedCount = clipJobs.filter((j) => j.url).length;
      const progress = Math.min(completedCount * 33, 99);
      return NextResponse.json({
        data: { status: "processing", progress, result: null, error: null },
      });
    }

    // Single-clip or unknown — cron is handling it
    return NextResponse.json({
      data: { status: "processing", progress: 30, result: null, error: null },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
