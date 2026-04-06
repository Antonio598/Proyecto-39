import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { handleApiError } from "@/lib/utils/errors";

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const admin = createAdminClient();

    const { data } = await admin
      .from("brand_settings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    return NextResponse.json({
      data: data
        ? {
            primary_color: data.primary_color,
            secondary_color: data.secondary_color,
            font_primary: data.font_primary,
            tone_of_voice: data.tone_of_voice,
            niche: data.niche,
            guidelines: data.guidelines,
            ai_context: data.ai_context,
            updated_at: data.updated_at,
          }
        : null,
      keys: {
        hasOpenaiKey: !!data?.openai_key,
        hasNanoBananaKey: !!data?.nano_banana_key,
        hasKlingKey: !!data?.kling_key,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const body = await request.json();
    const admin = createAdminClient();

    const {
      primaryColor, secondaryColor, fontPrimary, toneOfVoice,
      niche, guidelines, aiContext, nanoBananaKey, klingKey, openaiKey,
    } = body;

    // Build update payload — only include key fields when the user actually typed something
    const upsertPayload: Record<string, unknown> = {
      workspace_id: workspaceId,
      updated_at: new Date().toISOString(),
    };

    if (primaryColor !== undefined) upsertPayload.primary_color = primaryColor;
    if (secondaryColor !== undefined) upsertPayload.secondary_color = secondaryColor;
    if (fontPrimary !== undefined) upsertPayload.font_primary = fontPrimary;
    if (toneOfVoice !== undefined) upsertPayload.tone_of_voice = toneOfVoice;
    if (niche !== undefined) upsertPayload.niche = niche || null;
    if (guidelines !== undefined) upsertPayload.guidelines = guidelines || null;
    if (aiContext !== undefined) upsertPayload.ai_context = aiContext || null;

    // Only overwrite keys when a non-empty value is provided
    if (openaiKey?.trim()) upsertPayload.openai_key = openaiKey.trim();
    if (nanoBananaKey?.trim()) upsertPayload.nano_banana_key = nanoBananaKey.trim();
    if (klingKey?.trim()) upsertPayload.kling_key = klingKey.trim();

    const { data, error } = await admin
      .from("brand_settings")
      .upsert(upsertPayload, { onConflict: "workspace_id" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
