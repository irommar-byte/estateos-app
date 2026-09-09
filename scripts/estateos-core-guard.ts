import 'dotenv/config';
import {
  collectCoreGuardSample,
  deliverCoreGuardAlerts,
  evaluateCoreGuardSample,
  persistCoreGuardCycle,
} from '@/lib/coreGuard';
import { prisma } from '@/lib/prisma';

const SAMPLE_INTERVAL_MS = 60_000;
const FULL_SCAN_INTERVAL_MS = 5 * 60_000;
const STARTUP_GRACE_MS = 10 * 60_000;

let stopping = false;
const startedAt = Date.now();
let nextFullScanAt = startedAt + STARTUP_GRACE_MS;

function requestStop(signal: string) {
  stopping = true;
  console.info(`[core-guard] ${signal}; kończę po bieżącym pomiarze`);
}

process.once('SIGTERM', () => requestStop('SIGTERM'));
process.once('SIGINT', () => requestStop('SIGINT'));

async function sleepUntil(timestamp: number) {
  const remaining = Math.max(0, timestamp - Date.now());
  await new Promise<void>((resolve) => setTimeout(resolve, remaining));
}

async function main() {
  console.info('[core-guard] start');
  while (!stopping) {
    const cycleStartedAt = Date.now();
    const full = cycleStartedAt >= nextFullScanAt;
    try {
      const sample = await collectCoreGuardSample({ full });
      const candidates = evaluateCoreGuardSample(sample);
      await persistCoreGuardCycle(sample, candidates);
          if (Date.now() >= startedAt + STARTUP_GRACE_MS) {
            await deliverCoreGuardAlerts();
          }
      if (full) nextFullScanAt = cycleStartedAt + FULL_SCAN_INTERVAL_MS;
      console.info(
        `[core-guard] sample level=${sample.level} candidates=${candidates.length} full=${full}`,
      );
    } catch (error) {
      console.error('[core-guard] cycle failed', error);
    }
    if (!stopping) await sleepUntil(cycleStartedAt + SAMPLE_INTERVAL_MS);
  }
}

main()
  .catch((error) => {
    console.error('[core-guard] fatal', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
    console.info('[core-guard] stopped');
  });
