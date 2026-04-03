import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { startAiGeneration } from "@/lib/ai/orchestrator";
import { handleApiError, ApiError } from "@/lib/utils/errors";

export async function POST(request: Request) {
  try {
    const { session, workspaceId } = await requireWorkspaceAccess(request);
    const supabase = await createClient();
    const body = await request.json();

    const {
      format, platform, promptText, tone = "professional",
      language = "es", useHashtags = true, useEmojis = true,
      promptId,
    } = body;

    if (!format || !platform || !promptText) {
      throw new ApiError("format, platform, and promptText are required", 400);
    }

    // Fetch workspace AI keys from brand_settings / workspace metadata
    const { data: brand } = await supabase
      .from("brand_settings")
      .select("ai_context")
      .eq("workspace_id", workspaceId)
      .single();

    // Get AI keys from workspace metadata (stored encrypted)
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("metadata")
      .eq("id", workspaceId)
      .single();

    const meta = (workspace?.metadata as Record<string, string>) ?? {};
    const nanoBananaKey = meta.nano_banana_key;
    const klingKey = meta.kling_key;

    if (!nanoBananaKey && !klingKey) {
      throw new ApiError(
        "Configure las API keys de IA en la configuración del workspace antes de generar contenido.",
        400,
        "NO_AI_KEYS"
      );
    }

    // Create a DB record for tracking
    const { data: generatedPost, error: insertError } = await supabase
      .from("generated_posts")
      .insert({
        workspace_id: workspaceId,
        created_by: session.user.id,
        format,
        caption: null,
        hashtags: [],
        media_urls: [],
        ai_prompt_id: promptId ?? null,
        ai_job_id: null,
        ai_provider: null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Start async AI generation job
    try {
      const jobRef = await startAiGeneration({
        format,
        platform,
        promptText,
        tone,
        language,
        useHashtags,
        useEmojis,
        brandContext: brand?.ai_context ?? undefined,
        nanoBananaKey,
        klingKey,
      });

      // Update with job reference
      await supabase
        .from("generated_posts")
        .update({
          ai_job_id: jobRef.jobId,
          ai_provider: jobRef.provider,
        })
        .eq("id", generatedPost.id);

      // Update prompt usage count
      if (promptId) {
        await supabase.rpc("increment_prompt_usage", { prompt_id: promptId });
      }

      return NextResponse.json({
        data: {
          postId: generatedPost.id,
          jobId: jobRef.jobId,
          provider: jobRef.provider,
          type: jobRef.type,
        },
      });
    } catch (aiError) {
      // Clean up orphan record
      await supabase.from("generated_posts").delete().eq("id", generatedPost.id);
      throw aiError;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
