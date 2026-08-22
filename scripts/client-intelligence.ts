#!/usr/bin/env npx tsx
async function main() {
  const port = process.env.PORT || '3000';
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || process.env.JWT_SECRET || '';
  const url = `http://127.0.0.1:${port}/api/cron/client-intelligence`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      job: 'client-intelligence',
      status: res.status,
      ...data,
    }),
  );
  if (!res.ok) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
