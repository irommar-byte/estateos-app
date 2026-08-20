#!/usr/bin/env node
/**
 * Heartbeat PM2: tylko budzi Next.js. Sam import musi żyć w procesie `nieruchomosci`.
 * Czysty Node (bez npx/tsx) — cron */5 nie powinien za każdym razem odpalać TypeScriptu.
 */
async function main() {
  const port = process.env.PORT || '3000';
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || process.env.JWT_SECRET || '';
  const url = `http://127.0.0.1:${port}/api/cron/kei-auto-import`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await res.json().catch(() => ({}));
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      job: 'kei-auto-import',
      status: res.status,
      ...data,
    }),
  );
  if (!res.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
