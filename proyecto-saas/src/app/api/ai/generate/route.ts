import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { startAiGeneration, getAspectRatioForFormat } from "@/lib/ai/orchestrator";
import { handleApiError, ApiError } from "@/lib/utils/errors";
import { generateSpeech, captionToVoiceScript } from "@/lib/ai/elevenlabs";
import { KlingClient } from "@/lib/ai/kling";

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

    // ── Multi-clip sequential: >1 reference images → 3 × 10s clips concatenated ──
    const validImageUrls = (referenceImageUrls as string[] | undefined)?.filter(Boolean) ?? [];
    const isMultiClip = isVideo && validImageUrls.length > 1;

    let primaryJobId: string;
    let primaryProvider: "kling" | "nano_banana";
    let platformData: Record<string, unknown>;

    if (isMultiClip && klingKey) {
      const kling = new KlingClient(klingKey);
      const ar = (aspectRatio ?? getAspectRatioForFormat(format, platform)) as "9:16" | "16:9" | "1:1";
      const clips = validImageUrls.slice(0, 3);

      // Start only clip 1 — remaining clips are started sequentially by the status poller
      const clip1 = await kling.generateVideo({
        prompt: promptText,
        aspectRatio: ar,
        duration: 10,
        sound: false,
        referenceImageUrl: clips[0],
      });

      primaryJobId = clip1.jobId;
      primaryProvider = "kling";
      platformData = {
        referenceImageUrl: clips[0],
        jobType: "video",
        multi_clip: true,
        image_urls: clips,
        prompt: promptText,
        aspect_ratio: ar,
        clip_jobs: [
          { scene: 1, jobId: clip1.jobId, url: null },
          ...clips.slice(1).map((_, i) => ({ scene: i + 2, jobId: null, url: null })),
        ],
        ...(voiceUrl ? { voice_url: voiceUrl } : {}),
      };
    } else {
      // Single-clip path (1 image or text-to-video)
      const jobRef = await startAiGeneration({
        format, platform, promptText, tone, language, useHashtags, useEmojis,
        referenceImageUrl, referenceImageUrls, aspectRatio,
        sound: useVoice ? false : sound,
        brandContext: brand?.ai_context ?? undefined,
        nanoBananaKey, klingKey,
      });
      primaryJobId = jobRef.jobId;
      primaryProvider = jobRef.provider;
      platformData = {
        referenceImageUrl,
        jobType: jobRef.type,
        ...(voiceUrl ? { voice_url: voiceUrl } : {}),
      };
    }

    let finalPostId = postId;

    if (postId) {
      await admin
        .from("generated_posts")
        .update({ ai_job_id: primaryJobId, ai_provider: primaryProvider, platform_data: platformData })
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
          ai_provider: primaryProvider,
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
        provider: primaryProvider,
        type: isMultiClip ? "video" : platformData.jobType,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
