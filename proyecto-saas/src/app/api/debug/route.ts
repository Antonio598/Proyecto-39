import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { KlingClient } from "@/lib/ai/kling";

export const dynamic = "force-dynamic";

// Protected by CRON_SECRET — hit this URL to diagnose the system:
// GET /api/debug  (with header  Authorization: Bearer <CRON_SECRET>)
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report: Record<string, unknown> = {};

  // 1. ENV vars
  report.env = {
    CRON_SECRET: !!process.env.CRON_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "(not set)",
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(not set)",
    SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  // 2. DB connection
  try {
    const admin = createAdminClient();
    const { data: workspaces, error } = await admin
      .from("workspaces")
      .select("id, name, slug")
      .limit(10);

    if (error) {
      report.db = { ok: false, error: error.message };
    } else {
      report.db = { ok: true, workspaces_count: workspaces?.length ?? 0, workspaces };
    }

    // 3. Brand settings (API keys configured?)
    if (!error) {
      const { data: brands } = await admin
        .from("brand_settings")
        .select("workspace_id, kling_key, nano_banana_key, openai_key, elevenlabs_key");

      report.brand_settings = (brands ?? []).map((b) => ({
        workspace_id: b.workspace_id,
        has_kling_key: !!b.kling_key,
        has_nano_banana_key: !!b.nano_banana_key,
        has_openai_key: !!b.openai_key,
        has_elevenlabs_key: !!b.elevenlabs_key,
        kling_key_preview: b.kling_key ? b.kling_key.slice(0, 8) + "…" : null,
      }));

      // 4. Pending Kling jobs
      const { data: pending } = await admin
        .from("generated_posts")
        .select("id, workspace_id, ai_job_id, created_at, platform_data")
        .eq("ai_provider", "kling")
        .or("media_urls.is.null,media_urls.eq.{}")
        .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .limit(5);

      report.pending_kling_jobs = pending?.length ?? 0;

      // 5. Kling API test (using first workspace that has a key)
      const brandWithKey = brands?.find((b) => b.kling_key);
      if (brandWithKey?.kling_key) {
        try {
          const kling = new KlingClient(brandWithKey.kling_key);
          // Test by checking a fake task_id — will return 404/error but proves API is reachable
          const testResult = await fetch("https://kling3api.com/api/status?task_id=test-connection", {
            headers: { Authorization: `Bearer ${brandWithKey.kling_key}`, "Content-Type": "application/json" },
            cache: "no-store",
          });
          const raw = await testResult.json().catch(() => ({}));
          report.kling_api = {
            reachable: true,
            http_status: testResult.status,
            response: raw,
          };
          void kling; // used above implicitly via headers
        } catch (err) {
          report.kling_api = {
            reachable: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      } else {
        report.kling_api = { skipped: true, reason: "No workspace has a kling_key configured" };
      }

      // 6. Storage bucket check
      const { data: buckets } = await admin.storage.listBuckets();
      report.storage_buckets = (buckets ?? []).map((b) => ({ name: b.name, public: b.public }));
    }
  } catch (err) {
    report.db = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json(report, { status: 200 });
}
