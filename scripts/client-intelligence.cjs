#!/usr/bin/env node
/**
 * Heartbeat PM2: budzi Next.js, żeby EstateOS™ Intelligence mogło wysłać
 * jedną pewną propozycję w imieniu agenta. Czysty Node (bez tsx).
 */
const { runCronHeartbeat } = require("./lib/cronHeartbeat.cjs");

runCronHeartbeat("client-intelligence", "/api/cron/client-intelligence").catch((err) => {
  console.error(err);
  process.exit(1);
});
