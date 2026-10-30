#!/usr/bin/env node
/** Przed budowaniem strony czeka, aż skończy się import RCN (oba naraz nie mieszczą się w pamięci serwera). */
const { execSync } = require("node:child_process");
const started = Date.now();
const LIMIT_MS = 75 * 60 * 1000;
function running() {
  try {
    return execSync("pgrep -f 'ingest-rcn-market' || true").toString().trim().length > 0;
  } catch {
    return false;
  }
}
(async () => {
  let announced = false;
  while (running() && Date.now() - started < LIMIT_MS) {
    if (!announced) {
      console.log(JSON.stringify({ step: "wait-rcn-ingest", message: "Trwa import RCN — czekam z budowaniem strony" }));
      announced = true;
    }
    await new Promise((r) => setTimeout(r, 15000));
  }
  console.log(JSON.stringify({ ok: true, step: "wait-rcn-ingest", waitedMs: Date.now() - started }));
})();
