// Diagnostic endpoint — returns raw Kling API responses
// Usage: GET /api/ai/kling-debug          → runs a minimal test generate
//        GET /api/ai/kling-debug?task_id= → checks status of existing task
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/session";

export const maxDuration = 30;

const BASE_URL = "https://kling3api.com";

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireWorkspaceAccess(request);
    const url = new URL(request.url);
    const taskId = url.searchParams.get("task_id");

    const admin = createAdminClient();
    const { data: brand } = await admin
      .from("brand_settings")
      .select("kling_key")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    const key = brand?.kling_key;
    if (!key) return NextResponse.json({ error: "No Kling key configured" }, { status: 400 });

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    };

    if (taskId) {
      // Check status of an existing task
      const statusUrl = `${BASE_URL}/api/status?task_id=${encodeURIComponent(taskId)}`;
      const res = await fetch(statusUrl, { headers, cache: "no-store" });
      const raw = await res.json().catch(() => ({}));
      return NextResponse.json({ endpoint: statusUrl, httpStatus: res.status, raw });
    }

    // Create a minimal test task (text-to-video, 3s, smallest possible)
    const generateBody = {
      model: "kling",
      task_type: "video_generation",
      input: {
        prompt: "a simple white background",
        duration: 3,
        aspect_ratio: "1:1",
        mode: "std",
        version: "2.6",
        cfg_scale: 0.5,
      },
    };

    const genRes = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify(generateBody),
      cache: "no-store",
    });
    const genRaw = await genRes.json().catch(() => ({}));

    return NextResponse.json({
      generateEndpoint: `${BASE_URL}/api/generate`,
      generateBody,
      httpStatus: genRes.status,
      raw: genRaw,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
