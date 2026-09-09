import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
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
const APP_ROOT = process.env.ADMIN_CORE_CWD || process.cwd();

let stopping = false;
const startedAt = Date.now();
let nextFullScanAt = startedAt + STARTUP_GRACE_MS;

function requestStop(signal: string) {
  stopping = true;
  console.info(`[core-guard] ${signal}; kończę po bieżącym pomiarze`);
}

process.once('SIGTERM', () => requestStop('SIGTERM'));
process.once('SIGINT', () => requestStop('SIGINT'));

function sleepUntil(timestamp: number) {
  const remaining = Math.max(0, timestamp - Date.now());
  return new Promise<void>((resolve) => setTimeout(resolve, remaining));
}

function deploymentInProgress() {
  return (
    fs.existsSync(path.join(APP_ROOT, '.next-build')) ||
    fs.existsSync(path.join(APP_ROOT, '.next', 'lock'))
  );
}

async function main() {
  console.info('[core-guard] start');
  while (!stopping) {
    const cycleStartedAt = Date.now();
    const maintenance = deploymentInProgress();
    const quiet = maintenance || Date.now() < startedAt + STARTUP_GRACE_MS;
    const full = !quiet && cycleStartedAt >= nextFullScanAt;
    try {
      const sample = await collectCoreGuardSample({ full });
      const candidates = quiet ? [] : evaluateCoreGuardSample(sample);
      await persistCoreGuardCycle(sample, candidates, { ignoreRestartDeltas: quiet });
      if (!quiet) await deliverCoreGuardAlerts();
      if (full) nextFullScanAt = cycleStartedAt + FULL_SCAN_INTERVAL_MS;
      console.info(
        `[core-guard] sample level=${sample.level} candidates=${candidates.length} full=${full} maintenance=${maintenance} quiet=${quiet}`,
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
