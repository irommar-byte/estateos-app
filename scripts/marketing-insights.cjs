#!/usr/bin/env node

const { runCronHeartbeat } = require("./lib/cronHeartbeat.cjs");

runCronHeartbeat("marketing-insights", "/api/cron/marketing-insights").catch((error) => {
  console.error(error);
  process.exit(1);
});
