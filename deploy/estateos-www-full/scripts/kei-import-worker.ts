import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import { runKeiImportJob } from '@/lib/keiAmerImportJobs';
import { tickKeiAutoImport } from '@/lib/keiAutoImport';
import { claimNextKeiImportJob } from '@/lib/keiImportLease';
import { prisma } from '@/lib/prisma';

const POLL_MS = 2_000;
const AUTO_TICK_MS = 60_000;
const ownerId = `${os.hostname()}:${process.pid}:${randomUUID()}`;

let stopping = false;
let nextAutoTickAt = 0;
let failureDelayMs = 1_000;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function requestStop(signal: string) {
  stopping = true;
  console.info(`[kei-import-worker] ${signal}; kończę po bieżącym zadaniu`);
}

process.once('SIGTERM', () => requestStop('SIGTERM'));
process.once('SIGINT', () => requestStop('SIGINT'));

async function main() {
  console.info(`[kei-import-worker] start owner=${ownerId}`);
  while (!stopping) {
    try {
      const now = Date.now();
      if (now >= nextAutoTickAt) {
        const tick = await tickKeiAutoImport();
        if (tick.ran || !['disabled', 'not_due', 'job_running'].includes(tick.reason)) {
          console.info('[kei-import-worker] auto tick', tick);
        }
        nextAutoTickAt = now + AUTO_TICK_MS;
      }

      const jobId = await claimNextKeiImportJob(ownerId);
      if (jobId) {
        console.info(`[kei-import-worker] claimed ${jobId}`);
        await runKeiImportJob(jobId, ownerId);
        failureDelayMs = 1_000;
        continue;
      }

      failureDelayMs = 1_000;
      await delay(POLL_MS);
    } catch (error) {
      console.error('[kei-import-worker] cycle failed', error);
      await delay(failureDelayMs);
      failureDelayMs = Math.min(30_000, failureDelayMs * 2);
    }
  }
}

main()
  .catch((error) => {
    console.error('[kei-import-worker] fatal', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
    console.info('[kei-import-worker] stopped');
  });
