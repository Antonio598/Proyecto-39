// Internal cron scheduler — runs once when the Next.js server boots (Docker/Easypanel).
// Replaces the need to configure cron jobs manually in Easypanel or Vercel.

export async function register() {
  // Only in the Node.js runtime (not Edge, not during next build)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const cron = (await import("node-cron")).default;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.warn("[Cron] CRON_SECRET not set — internal scheduler disabled");
    return;
  }

  const call = (path: string) =>
    fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    }).catch((e: unknown) => console.error(`[Cron] ${path} error:`, e));

  // Publish scheduled posts — every minute
  cron.schedule("* * * * *", () => call("/api/cron/publish"));

  // Process pending Kling video jobs — every minute (runs in background even if page is closed)
  cron.schedule("* * * * *", () => call("/api/cron/process-videos"));

  // Automation content rules — every 15 minutes
  cron.schedule("*/15 * * * *", () => call("/api/cron/automation"));

  // Daily metrics sync — 6 AM UTC
  cron.schedule("0 6 * * *", () => call("/api/cron/sync-metrics"));

  // Weekly token refresh — Sunday 3 AM UTC
  cron.schedule("0 3 * * 0", () => call("/api/cron/refresh-tokens"));

  console.log("[Cron] Internal scheduler active — all jobs registered");
}
