#!/usr/bin/env node
/**
 * PM2 (piątek rano): przygotowuje tygodniowe podsumowania dla klientów.
 * Każdy mail czeka na akceptację agenta w „Do wysłania”, chyba że agent włączył automat.
 */
const { runCronHeartbeat } = require("./lib/cronHeartbeat.cjs");

runCronHeartbeat("client-weekly-digest", "/api/cron/client-weekly-digest").catch((err) => {
  console.error(err);
  process.exit(1);
});
