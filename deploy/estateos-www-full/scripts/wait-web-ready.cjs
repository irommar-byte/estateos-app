#!/usr/bin/env node
/** Wait until local Next responds after pm2 reload. */
const url = `http://127.0.0.1:${process.env.PORT || '3000'}/api/health`;
const maxMs = Number(process.env.WEB_READY_WAIT_MS || 45_000);

async function main() {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        console.log(JSON.stringify({ ok: true, waitedMs: Date.now() - started }));
        return;
      }
    } catch {
      /* still booting */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(JSON.stringify({ ok: false, waitedMs: Date.now() - started, note: 'timeout' }));
  process.exit(0);
}

main().catch(() => process.exit(0));
