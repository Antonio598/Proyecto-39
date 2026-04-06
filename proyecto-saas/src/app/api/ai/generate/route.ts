import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { startAiGeneration } from "@/lib/ai/orchestrator";
import { handleApiError, ApiError } from "@/lib/utils/errors";

export async function POST(request: Request) {
  try {
    const { session, workspaceId } = await requireWorkspaceAccess(request);
    const body = await request.json();

    const {
      format,
      platform,
      promptText,
      tone = "profesional",
      language = "es",
      useHashtags = true,
      useEmojis = true,
      referenceImageUrl,   // optional: image URL to use as base for video
      postId,              // optional: existing generated_posts record to update
    } = body;

    if (!format || !platform || !promptText) {
      throw new ApiError("format, platform y promptText son requeridos", 400);
    }

    const admin = createAdminClient();

    // Get workspace keys and brand context
    const [workspaceRes, brandRes] = await Promise.all([
      admin.from("workspaces").select("metadata").eq("id", workspaceId).single(),
      admin.from("brand_settings").select("ai_context").eq("workspace_id", workspaceId).maybeSingle(),
    ]);

    const meta = (workspaceRes.data?.metadata as Record<string, string>) ?? {};
    const nanoBananaKey = meta.nano_banana_key;
    const klingKey = meta.kling_key;

    const isVideo = ["reel", "short", "long_video"].includes(format);

    if (isVideo && !klingKey) {
      throw new ApiError(
        "Configura tu API key de Kling AI en Integraciones para generar videos.",
        400,
        "NO_KLING_KEY"
      );
    }

    if (!isVideo && !nanoBananaKey) {
      throw new ApiError(
        "Configura tu API key de Nano Banana en Integraciones para generar imágenes.",
        400,
        "NO_NB_KEY"
      );
    }

    // Start AI generation job
    const jobRef = await startAiGeneration({
      format,
      platform,
      promptText,
      tone,
      language,
      useHashtags,
      useEmojis,
      referenceImageUrl,
      brandContext: brandRes.data?.ai_context ?? undefined,
      nanoBananaKey,
      klingKey,
    });

    // Update existing post or create new one
    let finalPostId = postId;

    if (postId) {
      // Update existing post record with new job info
      await admin
        .from("generated_posts")
        .update({
          ai_job_id: jobRef.jobId,
          ai_provider: jobRef.provider,
          platform_data: {
            referenceImageUrl,
            jobType: jobRef.type,
          },
        })
        .eq("id", postId);
    } else {
      // Create new post record
      const { data: newPost, error: insertError } = await admin
        .from("generated_posts")
        .insert({
          workspace_id: workspaceId,
          created_by: session.user.id,
          format,
          caption: null,
          hashtags: [],
          media_urls: [],
          ai_job_id: jobRef.jobId,
          ai_provider: jobRef.provider,
          platform_data: { platform, referenceImageUrl, jobType: jobRef.type },
        })
        .select()
        .single();

      if (insertError) throw insertError;
      finalPostId = newPost.id;
    }

    return NextResponse.json({
      data: {
        postId: finalPostId,
        jobId: jobRef.jobId,
        provider: jobRef.provider,
        type: jobRef.type,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
