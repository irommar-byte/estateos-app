#!/usr/bin/env node

const { runCronHeartbeat } = require("./lib/cronHeartbeat.cjs");

runCronHeartbeat("seller-marketing-renewals", "/api/cron/seller-marketing-renewals").catch(
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
