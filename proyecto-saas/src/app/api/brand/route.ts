import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/session";
import { handleApiError } from "@/lib/utils/errors";

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const [brandRes, wsRes] = await Promise.all([
      supabase.from("brand_settings").select("*").eq("workspace_id", workspaceId).single(),
      adminSupabase.from("workspaces").select("metadata").eq("id", workspaceId).single(),
    ]);

    const meta = (wsRes.data?.metadata as Record<string, string>) ?? {};

    return NextResponse.json({
      data: brandRes.data,
      keys: {
        hasOpenaiKey: !!meta.openai_key,
        hasNanoBananaKey: !!meta.nano_banana_key,
        hasKlingKey: !!meta.kling_key,
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
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const {
      primaryColor, secondaryColor, fontPrimary, toneOfVoice,
      niche, guidelines, aiContext, nanoBananaKey, klingKey, openaiKey,
    } = body;

    // Update brand settings
    const { data, error } = await supabase
      .from("brand_settings")
      .upsert({
        workspace_id: workspaceId,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        font_primary: fontPrimary,
        tone_of_voice: toneOfVoice,
        niche: niche || null,
        guidelines: guidelines || null,
        ai_context: aiContext || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "workspace_id" })
      .select()
      .single();

    if (error) throw error;

    // Store API keys in workspace metadata (using admin client)
    if (nanoBananaKey || klingKey || openaiKey) {
      const { data: ws } = await adminSupabase
        .from("workspaces")
        .select("metadata")
        .eq("id", workspaceId)
        .single();

      const currentMeta = (ws?.metadata as Record<string, string>) ?? {};
      const updatedMeta: Record<string, string> = { ...currentMeta };

      if (nanoBananaKey) updatedMeta.nano_banana_key = nanoBananaKey;
      if (klingKey) updatedMeta.kling_key = klingKey;
      if (openaiKey) updatedMeta.openai_key = openaiKey;

      await adminSupabase
        .from("workspaces")
        .update({ metadata: updatedMeta })
        .eq("id", workspaceId);
    }

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
