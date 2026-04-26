import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { handleApiError } from "@/lib/utils/errors";
import { processKlingJob, type GeneratedPostRow } from "@/lib/ai/video-processor";

export const maxDuration = 120;

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
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("ai_job_id", jobId)
      .single();

    if (!post) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Fast-path: already completed
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

    const { data: brand } = await admin
      .from("brand_settings")
      .select("nano_banana_key, kling_key")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    // Delegate to shared processor (same logic used by the background cron)
    const result = await processKlingJob(
      post as unknown as GeneratedPostRow,
      brand?.kling_key ?? "",
      workspaceId,
      admin,
      brand?.nano_banana_key ?? undefined,
    );

    if (result.status === "completed") {
      return NextResponse.json({
        data: {
          status: "completed",
          progress: 100,
          result: {
            postId: post.id,
            mediaUrls: result.mediaUrls,
            caption: result.caption,
            hashtags: result.hashtags,
          },
          error: null,
        },
      });
    }

    if (result.status === "failed") {
      return NextResponse.json({
        data: { status: "failed", progress: null, result: null, error: result.error },
      });
    }

    // processing
    return NextResponse.json({
      data: { status: "processing", progress: result.progress, result: null, error: null },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
