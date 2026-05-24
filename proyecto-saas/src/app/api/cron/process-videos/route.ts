import { NextResponse } from "next/server";
import { processVideoQueue } from "@/lib/ai/video-queue";

export const maxDuration = 300; // 5 min — FFmpeg concat + upload can take a while

// External trigger endpoint — kept for manual testing and health checks.
// The actual scheduler calls processVideoQueue() directly from instrumentation.ts
// to avoid HTTP self-calls that fail in Docker/EasyPanel.
export async function GET(request: Request) {
  const cronSecret = request.headers.get("authorization");
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await processVideoQueue();
  return NextResponse.json({ ok: true });
}
