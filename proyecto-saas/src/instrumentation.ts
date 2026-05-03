// Internal scheduler — runs once when the Next.js server boots (Docker/Easypanel).
// Uses only setInterval (no external deps) so webpack can bundle it without issues.

export async function register() {
  // Only run in the Node.js server process (not Edge runtime)
  if (process.env.NEXT_RUNTIME === "edge") return;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error(
      "[Cron] ❌ CRON_SECRET not set — scheduler DISABLED. " +
      "Add CRON_SECRET=<any-long-random-string> to your environment variables and redeploy."
    );
    return;
  }

  const call = (path: string) =>
    fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) console.error(`[Cron] ${path} → HTTP ${r.status}`);
      })
      .catch((e: unknown) => console.error(`[Cron] ${path} fetch error:`, e));

  console.log(`[Cron] ✅ Scheduler starting — baseUrl=${baseUrl}`);

  // Run immediately on boot to pick up jobs that got stuck during a restart
  setTimeout(() => {
    console.log("[Cron] Boot run: publish + process-videos");
    call("/api/cron/publish");
    call("/api/cron/process-videos");
  }, 10_000); // 10s after boot so the server is fully ready

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

  console.log("[Cron] ✅ Scheduler active — publish, process-videos, automation, metrics, tokens");
}
