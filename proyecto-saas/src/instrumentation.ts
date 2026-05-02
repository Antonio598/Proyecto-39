// Internal scheduler — runs once when the Next.js server boots (Docker/Easypanel).
// Uses only setInterval (no external deps) so webpack can bundle it without issues.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

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

  // Every minute: publish scheduled posts + advance pending video jobs
  setInterval(() => {
    call("/api/cron/publish");
    call("/api/cron/process-videos");
  }, 60_000);

  // Every 15 minutes: automation content rules
  setInterval(() => {
    call("/api/cron/automation");
  }, 15 * 60_000);

  // Every hour: check if daily/weekly jobs should run
  setInterval(() => {
    const now = new Date();
    const h = now.getUTCHours();
    const m = now.getUTCMinutes();
    const d = now.getUTCDay(); // 0 = Sunday

    if (h === 6 && m < 5) call("/api/cron/sync-metrics");
    if (d === 0 && h === 3 && m < 5) call("/api/cron/refresh-tokens");
  }, 60 * 60_000);

  console.log("[Cron] Internal scheduler active — publish, process-videos, automation, metrics, tokens");
}
