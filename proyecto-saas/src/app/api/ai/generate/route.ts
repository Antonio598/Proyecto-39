import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { startAiGeneration, startMultiClipGeneration } from "@/lib/ai/orchestrator";
import { handleApiError, ApiError } from "@/lib/utils/errors";
import { generateSpeech, captionToVoiceScript } from "@/lib/ai/elevenlabs";

export const maxDuration = 60;

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
      referenceImageUrl,
      referenceImageUrls,
      aspectRatio,
      sound,
      postId,
    } = body;

    if (!format || !platform || !promptText) {
      throw new ApiError("format, platform y promptText son requeridos", 400);
    }

    const admin = createAdminClient();

    // Read keys and brand context from brand_settings
    const { data: brand } = await admin
      .from("brand_settings")
      .select("openai_key, nano_banana_key, kling_key, elevenlabs_key, ai_context")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    const nanoBananaKey = brand?.nano_banana_key ?? undefined;
    const klingKey = brand?.kling_key ?? undefined;
    const elevenLabsKey = (brand as Record<string, unknown> | null)?.elevenlabs_key as string | undefined;

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

    // ── ElevenLabs voice-over pre-generation ──────────────────────────────
    // When: video format + ElevenLabs key configured + sound=true + postId known
    // We generate the TTS MP3 now (caption already exists on the post record)
    // and store it in Supabase Storage so the status poller can merge it later.
    let voiceUrl: string | undefined;
    const useVoice = isVideo && !!elevenLabsKey && sound && !!postId;

    if (useVoice && elevenLabsKey && postId) {
      // Fetch the caption from the existing generated_post
      const { data: existingPost } = await admin
        .from("generated_posts")
        .select("caption")
        .eq("id", postId)
        .single();

      const rawCaption = existingPost?.caption ?? promptText;
      const voiceScript = captionToVoiceScript(rawCaption);

      if (voiceScript.length > 0) {
        const audioBuffer = await generateSpeech({ text: voiceScript, apiKey: elevenLabsKey });

        // Upload MP3 to Supabase Storage
        const storagePath = `${workspaceId}/voice-overs/${postId}.mp3`;
        const { error: uploadError } = await admin.storage
          .from("workspace-media")
          .upload(storagePath, audioBuffer, { contentType: "audio/mpeg", upsert: true });

        if (!uploadError) {
          const { data: { publicUrl } } = admin.storage
            .from("workspace-media")
            .getPublicUrl(storagePath);
          voiceUrl = publicUrl;
        }
      }
    }

    // ── Multi-clip (3 images → 3 Kling jobs in parallel) or single-clip ────
    const multiClipUrls = (referenceImageUrls as string[] | undefined)?.filter(Boolean) ?? [];
    const useMultiClip = isVideo && multiClipUrls.length > 1;

    let primaryJobId: string;
    let aiProvider: string;
    let jobType: string;
    let multiClipJobs: { jobId: string; scene: number; imageUrl: string }[] | undefined;

    if (useMultiClip) {
      const multiRef = await startMultiClipGeneration({
        format,
        platform,
        promptText,
        tone,
        language,
        useHashtags,
        useEmojis,
        aspectRatio,
        sound: useVoice ? false : sound,
        brandContext: brand?.ai_context ?? undefined,
        klingKey: klingKey!,
        referenceImageUrls: multiClipUrls,
      });
      primaryJobId = multiRef.primaryJobId;
      aiProvider = multiRef.provider;
      jobType = multiRef.type;
      multiClipJobs = multiRef.jobs;
    } else {
      const jobRef = await startAiGeneration({
        format,
        platform,
        promptText,
        tone,
        language,
        useHashtags,
        useEmojis,
        referenceImageUrl,
        referenceImageUrls,
        aspectRatio,
        sound: useVoice ? false : sound,
        brandContext: brand?.ai_context ?? undefined,
        nanoBananaKey,
        klingKey,
      });
      primaryJobId = jobRef.jobId;
      aiProvider = jobRef.provider;
      jobType = jobRef.type;
    }

    const platformData = {
      referenceImageUrl: multiClipUrls[0] ?? referenceImageUrl,
      jobType,
      ...(voiceUrl ? { voice_url: voiceUrl } : {}),
      ...(multiClipJobs ? { multi_clip_jobs: multiClipJobs } : {}),
    };

    let finalPostId = postId;

    if (postId) {
      await admin
        .from("generated_posts")
        .update({ ai_job_id: primaryJobId, ai_provider: aiProvider, platform_data: platformData })
        .eq("id", postId);
    } else {
      const { data: newPost, error: insertError } = await admin
        .from("generated_posts")
        .insert({
          workspace_id: workspaceId,
          created_by: session.user.id,
          format,
          caption: null,
          hashtags: [],
          media_urls: [],
          ai_job_id: primaryJobId,
          ai_provider: aiProvider,
          platform_data: { platform, ...platformData },
        })
        .select()
        .single();

      if (insertError) throw insertError;
      finalPostId = newPost.id;
    }

    return NextResponse.json({
      data: {
        postId: finalPostId,
        jobId: primaryJobId,
        provider: aiProvider,
        type: jobType,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
