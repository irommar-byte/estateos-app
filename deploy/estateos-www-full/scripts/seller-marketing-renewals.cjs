#!/usr/bin/env node

async function main() {
  const port = process.env.PORT || '3000';
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || process.env.JWT_SECRET || '';
  const response = await fetch(`http://127.0.0.1:${port}/api/cron/seller-marketing-renewals`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await response.json().catch(() => ({}));
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      job: 'seller-marketing-renewals',
      status: response.status,
      ...data,
    }),
  );
  if (!response.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
