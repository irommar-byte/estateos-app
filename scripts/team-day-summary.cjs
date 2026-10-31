#!/usr/bin/env node
/**
 * PM2 (co godzinę): od 20:00 czasu warszawskiego dopisuje do Dziennika zespołu
 * streszczenie dnia każdego agenta i kierownika — raz na dzień.
 */
const { runCronHeartbeat } = require("./lib/cronHeartbeat.cjs");

runCronHeartbeat("team-day-summary", "/api/cron/team-day-summary").catch((err) => {
  console.error(err);
  process.exit(1);
});
