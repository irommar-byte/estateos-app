#!/usr/bin/env node
/**
 * Wait for KEI import jobs to leave queued/running before pm2 reload.
 * Avoids mid-import ChunkLoadError (sharp / openai) after deploy.
 */
const { PrismaClient } = require('@prisma/client');

const MAX_WAIT_MS = Number(process.env.KEI_IDLE_WAIT_MS || 180_000);
const POLL_MS = 4_000;

async function countActive(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS total FROM KeiAmerImportJob
     WHERE (status = 'running' AND updatedAt > DATE_SUB(NOW(3), INTERVAL 12 MINUTE))
        OR (status = 'queued' AND updatedAt > DATE_SUB(NOW(3), INTERVAL 2 MINUTE))`,
  );
  return Number(rows?.[0]?.total || 0);
}

async function main() {
  const prisma = new PrismaClient();
  const started = Date.now();
  try {
    for (;;) {
      const active = await countActive(prisma);
      if (active <= 0) {
        console.log(JSON.stringify({ ok: true, waitedMs: Date.now() - started, active: 0 }));
        return;
      }
      if (Date.now() - started >= MAX_WAIT_MS) {
        console.log(
          JSON.stringify({
            ok: true,
            waitedMs: Date.now() - started,
            active,
            note: 'timeout_proceeding_with_reload',
          }),
        );
        return;
      }
      console.log(JSON.stringify({ ok: true, waiting: true, active, elapsedMs: Date.now() - started }));
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  // Do not block deploy on wait failures.
  process.exit(0);
});
