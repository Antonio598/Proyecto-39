import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { OpenAIClient } from "@/lib/ai/openai";
import { handleApiError, ApiError } from "@/lib/utils/errors";

export async function POST(request: Request) {
  try {
    const { session, workspaceId } = await requireWorkspaceAccess(request);
    const body = await request.json();

    const {
      platform,
      format,
      promptText,
      tone = "profesional",
      language = "es",
      useHashtags = true,
      useEmojis = true,
    } = body;

    if (!platform || !format || !promptText) {
      throw new ApiError("platform, format y promptText son requeridos", 400);
    }

    const admin = createAdminClient();

    // Get workspace keys and brand context
    const [workspaceRes, brandRes] = await Promise.all([
      admin.from("workspaces").select("metadata").eq("id", workspaceId).single(),
      admin.from("brand_settings").select("ai_context").eq("workspace_id", workspaceId).maybeSingle(),
    ]);

    const meta = (workspaceRes.data?.metadata as Record<string, string>) ?? {};
    const openaiKey = meta.openai_key;

    if (!openaiKey) {
      throw new ApiError(
        "Configura tu API key de OpenAI en Integraciones de IA para generar el guión.",
        400,
        "NO_OPENAI_KEY"
      );
    }

    const client = new OpenAIClient(openaiKey);

    const script = await client.generateScript({
      platform,
      format,
      promptText,
      tone,
      language,
      useHashtags,
      useEmojis,
      brandContext: brandRes.data?.ai_context ?? undefined,
    });

    // Create the generated_posts record now with the caption/hashtags
    const { data: post, error: insertError } = await admin
      .from("generated_posts")
      .insert({
        workspace_id: workspaceId,
        created_by: session.user.id,
        format,
        caption: script.caption,
        hashtags: script.hashtags,
        media_urls: [],
        ai_provider: "openai",
        ai_job_id: null,
        platform_data: {
          platform,
          imagePrompt: script.imagePrompt,
          videoPrompt: script.videoPrompt,
          tone,
          language,
        },
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      data: {
        postId: post.id,
        caption: script.caption,
        hashtags: script.hashtags,
        imagePrompt: script.imagePrompt,
        videoPrompt: script.videoPrompt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
