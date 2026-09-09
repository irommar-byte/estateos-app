import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCoreGuardSample, type CoreGuardSample } from '../src/lib/coreGuard';
import { getCoreGuardRunbook } from '../src/lib/coreGuardRunbooks';
import { isKernelCriticalEvent } from '../src/lib/coreGuardSystem';

function sample(overrides: Partial<CoreGuardSample> = {}): CoreGuardSample {
  return {
    collectedAt: new Date().toISOString(),
    host: 'test',
    level: 'ok',
    cpu: { percent: 10, cores: 2, load1: 0.1, load5: 0.1, load15: 0.1 },
    memory: { usedBytes: 100, totalBytes: 1000, freeBytes: 900, percent: 10 },
    swapUsedBytes: 0,
    disk: { usedBytes: 100, totalBytes: 1000, freeBytes: 900, percent: 10 },
    nginx: {
      sourceAvailable: true,
      requestsPerMin: 5,
      activeConnections: 1,
      windowRequests: 20,
      status499: 0,
      status5xx: 0,
      status502: 0,
      status504: 0,
      latencyMs: { p50: 20, p95: 50, p99: 80 },
      upstreamLatencyMs: { p95: 40 },
    },
    database: {
      up: true,
      latencyMs: 5,
      connections: 2,
      maxConnections: 50,
      abortedClients: 0,
    },
    processes: [
      {
        id: 1,
        name: 'nieruchomosci',
        status: 'online',
        cpu: 1,
        memoryBytes: 300_000_000,
        uptimeMs: 10_000,
        restarts: 0,
        pid: 1,
        commitSha: 'abc',
        cronRestart: null,
        execMode: 'cluster_mode',
        kind: 'daemon',
      },
      {
        id: 2,
        name: 'nieruchomosci',
        status: 'online',
        cpu: 1,
        memoryBytes: 300_000_000,
        uptimeMs: 10_000,
        restarts: 0,
        pid: 2,
        commitSha: 'abc',
        cronRestart: null,
        execMode: 'cluster_mode',
        kind: 'daemon',
      },
      {
        id: 3,
        name: 'estateos-core-guard',
        status: 'online',
        cpu: 0,
        memoryBytes: 50_000_000,
        uptimeMs: 10_000,
        restarts: 0,
        pid: 3,
        commitSha: 'abc',
        cronRestart: null,
        execMode: 'fork_mode',
        kind: 'daemon',
      },
    ],
    kei: { queued: 0, running: 0, expired: 0, oldestQueuedAt: null },
    synthetic: { ok: true, status: 200, latencyMs: 20 },
    runtimeWorkers: [],
    ...overrides,
  } as CoreGuardSample;
}

test('CORE Guard stays quiet for a healthy sample', () => {
  assert.deepEqual(evaluateCoreGuardSample(sample()), []);
});

test('CORE Guard emits stable fingerprints for sustained thresholds', () => {
  const candidates = evaluateCoreGuardSample(
    sample({
      memory: { usedBytes: 950, totalBytes: 1000, freeBytes: 50, percent: 95 },
      swapUsedBytes: 1024 ** 3,
      nginx: {
        ...sample().nginx,
        status5xx: 5,
        status502: 3,
        status504: 2,
      },
    }),
  );
  assert.equal(candidates.some((item) => item.fingerprint === 'quick:memory-pressure'), true);
  assert.equal(candidates.find((item) => item.fingerprint === 'quick:nginx-5xx')?.severity, 'critical');
});

test('CORE Guard ignores a single stray 5xx in the five-minute window', () => {
  const candidates = evaluateCoreGuardSample(
    sample({
      nginx: {
        ...sample().nginx,
        status5xx: 1,
        status502: 1,
      },
    }),
  );
  assert.equal(candidates.some((item) => item.fingerprint === 'quick:nginx-5xx'), false);
});

test('kernel critical events ignore journalctl empty output', () => {
  assert.equal(isKernelCriticalEvent('-- No entries --'), false);
  assert.equal(isKernelCriticalEvent('No entries'), false);
  assert.equal(isKernelCriticalEvent('watchdog: BUG: soft lockup - CPU#1 stuck for 22s!'), true);
});

test('CORE Guard ignores journalctl chrome as a kernel lockup', () => {
  const candidates = evaluateCoreGuardSample(
    sample({
      full: {
        findings: [
          {
            id: 'junk',
            severity: 'info',
            title: 'Pliki tymczasowe i niedokończone pobrania',
            detail: 'Cache',
            fixable: true,
          },
        ],
        systemdFailed: [],
        timers: [],
        docker: [],
        listeningPorts: [],
        kernelWarnings: ['-- No entries --', 'No entries'],
        deploySha: 'abc',
        backupAgeHours: 3,
        cron: [],
        pressure: {},
        inodeUsage: [],
        tls: { host: 'estateos.pl', daysRemaining: 80, validTo: null, error: null },
        dbDigests: [],
      } as never,
    }),
  );
  assert.equal(candidates.some((item) => item.fingerprint === 'full:kernel-watchdog'), false);
  assert.equal(candidates.some((item) => item.type === 'junk'), false);
});

test('CORE Guard schedules rolling recycle before PM2 kills a worker', () => {
  const candidates = evaluateCoreGuardSample(
    sample({
      processes: sample().processes.map((process) =>
        process.name === 'nieruchomosci'
          ? { ...process, memoryBytes: 880 * 1024 * 1024, uptimeMs: 20 * 60_000 }
          : process,
      ),
    }),
  );
  assert.equal(candidates.some((item) => item.fingerprint === 'quick:web-recycle'), true);
  assert.equal(candidates.find((item) => item.fingerprint === 'quick:web-recycle')?.autoFixable, true);
  assert.equal(candidates.some((item) => item.fingerprint === 'quick:web-memory'), false);
});

test('CORE Guard does not treat a warmed 1.5 GiB pair as an outage', () => {
  const candidates = evaluateCoreGuardSample(
    sample({
      processes: sample().processes.map((process) =>
        process.name === 'nieruchomosci'
          ? { ...process, memoryBytes: 750_000_000, uptimeMs: 20 * 60_000 }
          : process,
      ),
    }),
  );
  assert.equal(candidates.some((item) => item.fingerprint === 'quick:web-memory'), false);
  assert.equal(candidates.some((item) => item.fingerprint === 'quick:web-recycle'), false);
});

test('CORE Guard exposes only allowlisted runbooks', () => {
  assert.equal(getCoreGuardRunbook('safe-cleanup')?.automatic, true);
  assert.equal(getCoreGuardRunbook('reset-pm2-counters')?.automatic, true);
  assert.equal(getCoreGuardRunbook('recycle-web')?.automatic, true);
  assert.equal(getCoreGuardRunbook('reload-web')?.automatic, false);
  assert.equal(getCoreGuardRunbook('rm-rf'), null);
});
