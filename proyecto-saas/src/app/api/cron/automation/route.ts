import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OpenAIClient } from "@/lib/ai/openai";
import type { PostFormat, SocialPlatform } from "@/types/database";

export const maxDuration = 60;

// Runs every 15 minutes — finds active rules with a matching time slot and generates content
export async function GET(request: Request) {
  const cronSecret = request.headers.get("authorization");
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const todayDayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Fetch all active rules with their social accounts and workspace info
  const { data: rules, error } = await admin
    .from("posting_rules")
    .select("*, social_account:social_accounts(*)")
    .eq("is_active", true);

  if (error) {
    console.error("[Cron Automation] Query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { ruleId: string; status: "skipped" | "created" | "error"; reason?: string }[] = [];

  for (const rule of rules ?? []) {
    try {
      const account = rule.social_account;
      if (!account) {
        results.push({ ruleId: rule.id, status: "skipped", reason: "no social account" });
        continue;
      }

      // Check if today is an allowed day
      if (!rule.allowed_days.includes(todayDayOfWeek)) {
        results.push({ ruleId: rule.id, status: "skipped", reason: "day not allowed" });
        continue;
      }

      // Check if any time slot matches the current 15-min window
      const slots = (rule.time_slots as Array<{ hour: number; minute: number }>) ?? [];
      const matchingSlot = slots.find((slot) => {
        if (slot.hour !== currentHour) return false;
        // Match within a 15-min window (cron runs every 15 min)
        return currentMinute >= slot.minute && currentMinute < slot.minute + 15;
      });

      if (!matchingSlot) {
        results.push({ ruleId: rule.id, status: "skipped", reason: "no matching time slot" });
        continue;
      }

      // Dedup: check if we already created a post for this rule in this hour today
      const slotTime = new Date(now);
      slotTime.setHours(matchingSlot.hour, matchingSlot.minute, 0, 0);
      const slotEnd = new Date(slotTime.getTime() + 15 * 60 * 1000);

      const { data: existing } = await admin
        .from("scheduled_posts")
        .select("id")
        .eq("rule_id", rule.id)
        .gte("scheduled_at", slotTime.toISOString())
        .lt("scheduled_at", slotEnd.toISOString())
        .maybeSingle();

      if (existing) {
        results.push({ ruleId: rule.id, status: "skipped", reason: "already created for this slot" });
        continue;
      }

      // Get brand settings (OpenAI key + brand context) for this workspace
      const { data: brand } = await admin
        .from("brand_settings")
        .select("openai_key, ai_context")
        .eq("workspace_id", rule.workspace_id)
        .maybeSingle();

      if (!brand?.openai_key) {
        results.push({ ruleId: rule.id, status: "skipped", reason: "no OpenAI key configured" });
        continue;
      }

      // Pick a format from the rule (cycle through to avoid always picking same format)
      const formats = rule.formats as PostFormat[];
      if (!formats.length) {
        results.push({ ruleId: rule.id, status: "skipped", reason: "no formats configured" });
        continue;
      }
      const aiSettings = (rule.ai_settings as Record<string, unknown>) ?? {};
      const format = formats[now.getDate() % formats.length]; // rotate daily
      const platform = account.platform as SocialPlatform;

      const tone = (aiSettings.tone as string) ?? "profesional";
      const language = (aiSettings.language as string) ?? "es";
      const useHashtags = (aiSettings.useHashtags as boolean) ?? true;
      const useEmojis = (aiSettings.useEmojis as boolean) ?? true;
      const promptText = (aiSettings.basePrompt as string) ?? `Crea contenido de ${format} para ${platform}`;

      // Generate script via OpenAI
      const openai = new OpenAIClient(brand.openai_key);
      const script = await openai.generateScript({
        platform,
        format,
        promptText,
        tone,
        language,
        useHashtags,
        useEmojis,
        brandContext: brand.ai_context ?? undefined,
      });

      // Create generated_post record
      const { data: generatedPost, error: gpError } = await admin
        .from("generated_posts")
        .insert({
          workspace_id: rule.workspace_id,
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
            scenePrompts: script.scenePrompts,
            tone,
            language,
            source: "automation_rule",
          },
        })
        .select()
        .single();

      if (gpError || !generatedPost) {
        results.push({ ruleId: rule.id, status: "error", reason: gpError?.message ?? "insert failed" });
        continue;
      }

      // Determine publish status based on rule's publish_mode
      const postStatus = rule.publish_mode === "auto" ? "approved" : "pending_approval";

      // Create scheduled_post at the matching slot time
      const { error: spError } = await admin
        .from("scheduled_posts")
        .insert({
          workspace_id: rule.workspace_id,
          generated_post_id: generatedPost.id,
          social_account_id: rule.social_account_id,
          status: postStatus,
          publish_mode: rule.publish_mode,
          scheduled_at: slotTime.toISOString(),
          rule_id: rule.id,
        });

      if (spError) {
        results.push({ ruleId: rule.id, status: "error", reason: spError.message });
        continue;
      }

      console.log(`[Cron Automation] Created post for rule ${rule.id} (${rule.name}) at ${slotTime.toISOString()}, status: ${postStatus}`);
      results.push({ ruleId: rule.id, status: "created" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Cron Automation] Error for rule ${rule.id}:`, msg);
      results.push({ ruleId: rule.id, status: "error", reason: msg });
    }
  }

  return NextResponse.json({
    processed: results.length,
    created: results.filter((r) => r.status === "created").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  });
}
