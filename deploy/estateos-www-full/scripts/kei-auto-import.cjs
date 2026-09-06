#!/usr/bin/env node
/**
 * Heartbeat PM2: only wakes Next.js. The import itself must live in `nieruchomosci`.
 * Plain Node (no npx/tsx) so the every-5-minute cron does not compile TypeScript.
 */
const { runCronHeartbeat } = require("./lib/cronHeartbeat.cjs");

runCronHeartbeat("kei-auto-import", "/api/cron/kei-auto-import").catch((err) => {
  console.error(err);
  process.exit(1);
});
