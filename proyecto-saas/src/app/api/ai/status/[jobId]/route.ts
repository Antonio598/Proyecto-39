import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { pollJobStatus } from "@/lib/ai/orchestrator";
import { handleApiError } from "@/lib/utils/errors";

export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const { jobId } = await params;
    const admin = createAdminClient();

    // Get the generated post record to find provider
    const { data: post } = await admin
      .from("generated_posts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("ai_job_id", jobId)
      .single();

    if (!post) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // If already completed (has media_urls or caption), return cached result
    if (post.media_urls?.length > 0 || post.caption) {
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
        },
      });
    }

    // Get AI keys from brand_settings
    const { data: brand } = await admin
      .from("brand_settings")
      .select("nano_banana_key, kling_key")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    const jobStatus = await pollJobStatus(
      {
        provider: post.ai_provider as "nano_banana" | "kling",
        jobId,
        type: post.platform_data?.jobType ?? "image",
      },
      brand?.nano_banana_key ?? undefined,
      brand?.kling_key ?? undefined,
      post.platform_data
    );

    // If completed, update the DB record
    if (jobStatus.status === "completed") {
      const updates: Record<string, unknown> = {};
      if ("imageUrl" in jobStatus && jobStatus.imageUrl) {
        updates.media_urls = [jobStatus.imageUrl];
      }
      if ("videoUrl" in jobStatus && jobStatus.videoUrl) {
        updates.media_urls = [jobStatus.videoUrl];
      }
      if ("caption" in jobStatus && jobStatus.caption) {
        updates.caption = jobStatus.caption;
      }
      if ("hashtags" in jobStatus && jobStatus.hashtags) {
        updates.hashtags = jobStatus.hashtags;
      }

      if (Object.keys(updates).length > 0) {
        await admin
          .from("generated_posts")
          .update(updates)
          .eq("id", post.id);
      }
    }

    return NextResponse.json({
      data: {
        status: jobStatus.status,
        progress: ("progress" in jobStatus ? jobStatus.progress : undefined) ?? null,
        result:
          jobStatus.status === "completed"
            ? {
                postId: post.id,
                mediaUrls: (jobStatus as { videoUrl?: string; imageUrl?: string }).videoUrl
                  ? [(jobStatus as { videoUrl: string }).videoUrl]
                  : (jobStatus as { imageUrl?: string }).imageUrl
                  ? [(jobStatus as { imageUrl: string }).imageUrl]
                  : [],
                caption: (jobStatus as { caption?: string }).caption ?? null,
                hashtags: (jobStatus as { hashtags?: string[] }).hashtags ?? [],
              }
            : null,
        error: jobStatus.error ?? null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
