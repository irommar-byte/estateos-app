/**
 * Memory budget for the two Next.js WWW workers on the current VPS (~4.3 GiB).
 * Keep PM2 `max_memory_restart: "1G"` and `--max-old-space-size=768` in
 * ecosystem.config.cjs in sync — raising the worker cap without more RAM
 * pushes the box into swap/OOM.
 */
export const WEB_PM2_MAX_BYTES = 1024 * 1024 * 1024;
export const WEB_RSS_RECYCLE_BYTES = 960 * 1024 * 1024;
export const WEB_RSS_WARN_BYTES = 980 * 1024 * 1024;
export const WEB_RSS_TOTAL_WARN_BYTES = 2100 * 1024 * 1024;
export const WEB_RSS_TOTAL_INCIDENT_BYTES = 2300 * 1024 * 1024;
export const WEB_RECYCLE_MIN_UPTIME_MS = 10 * 60_000;
export const HEALTH_PING_TIMEOUT_MS = 4000;
export const HEALTH_SLOW_MS = 3000;

export function shouldRecycleWebWorker(rssBytes: number, uptimeMs: number) {
  return rssBytes >= WEB_RSS_RECYCLE_BYTES && uptimeMs >= WEB_RECYCLE_MIN_UPTIME_MS;
}

export function shouldFlagWebMemory(input: {
  maxRssBytes: number;
  totalRssBytes: number;
  maxUptimeMs: number;
}) {
  if (input.maxUptimeMs < WEB_RECYCLE_MIN_UPTIME_MS) return false;
  return input.maxRssBytes >= WEB_RSS_WARN_BYTES || input.totalRssBytes >= WEB_RSS_TOTAL_WARN_BYTES;
}

export function shouldFlagHealthSlow(ms: number, reached: boolean) {
  return reached && ms >= HEALTH_SLOW_MS;
}
