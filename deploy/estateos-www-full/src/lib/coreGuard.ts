import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { diagnoseServer, type ServerFinding } from '@/lib/adminServerDiagnose';
import { collectCoreGuardSystemSnapshot, isKernelCriticalEvent } from '@/lib/coreGuardSystem';
import {
  readCpuMetrics,
  readDiskMetrics,
  readMariaDbStatus,
  readMemoryMetrics,
  readNginxWindowMetrics,
  readPm2Processes,
} from '@/lib/adminServerOps';
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { getKeiWorkerQueueHealth } from '@/lib/keiImportLease';
import { prisma } from '@/lib/prisma';
import { notificationService } from '@/lib/services/notification.service';

const execFileAsync = promisify(execFile);
const APP_ROOT = process.env.ADMIN_CORE_CWD || process.cwd();
const SAMPLE_RETENTION_DAYS = 30;
const INCIDENT_RESOLVE_MINUTES = 7;
const ALERT_COOLDOWN_MINUTES = 30;

export type CoreGuardSeverity = 'info' | 'warning' | 'critical';

export type CoreGuardCandidate = {
  fingerprint: string;
  type: string;
  severity: CoreGuardSeverity;
  title: string;
  detail: string;
  evidence: Record<string, unknown>;
  recommendedAction?: string;
  autoFixable?: boolean;
  requiredOccurrences?: number;
};

export type CoreGuardSample = {
  collectedAt: string;
  host: string;
  level: 'ok' | 'warning' | 'critical';
  cpu: ReturnType<typeof readCpuMetrics>;
  memory: ReturnType<typeof readMemoryMetrics>;
  swapUsedBytes: number;
  disk: Awaited<ReturnType<typeof readDiskMetrics>>;
  nginx: Awaited<ReturnType<typeof readNginxWindowMetrics>>;
  database: {
    up: boolean;
    latencyMs: number | null;
    connections: number | null;
    maxConnections: number | null;
    abortedClients: number | null;
  };
  processes: Awaited<ReturnType<typeof readPm2Processes>>;
  kei: Awaited<ReturnType<typeof getKeiWorkerQueueHealth>> | null;
  synthetic: { ok: boolean; status: number | null; latencyMs: number | null };
  runtimeWorkers: Array<{
    pid: number;
    rssBytes: number;
    heapUsedBytes: number;
    externalBytes: number;
    eventLoopP95Ms: number;
    eventLoopP99Ms: number;
  }>;
  full?: {
    findings: ServerFinding[];
    systemdFailed: string[];
    timers: string[];
    docker: string[];
    listeningPorts: string[];
    kernelWarnings: string[];
    deploySha: string | null;
    backupAgeHours: number | null;
    cron: Awaited<ReturnType<typeof collectCoreGuardSystemSnapshot>>['cron'];
    pressure: Awaited<ReturnType<typeof collectCoreGuardSystemSnapshot>>['pressure'];
    inodeUsage: string[];
    tls: Awaited<ReturnType<typeof collectCoreGuardSystemSnapshot>>['tls'];
    dbDigests: Array<{
      digest: string;
      calls: number;
      totalMs: number;
      averageMs: number;
      rowsExamined: number;
    }>;
  };
};

async function run(command: string, args: string[], timeout = 5000): Promise<string> {
  try {
    const { stdout } = await execFileAsync(command, args, {
      timeout,
      maxBuffer: 2 * 1024 * 1024,
      encoding: 'utf8',
    });
    return String(stdout || '');
  } catch {
    return '';
  }
}

function readSwapUsedBytes() {
  try {
    const body = fs.readFileSync('/proc/meminfo', 'utf8');
    const totalKb = Number(body.match(/^SwapTotal:\s+(\d+)/m)?.[1] || 0);
    const freeKb = Number(body.match(/^SwapFree:\s+(\d+)/m)?.[1] || 0);
    return Math.max(0, totalKb - freeKb) * 1024;
  } catch {
    return 0;
  }
}

async function readDbMetrics() {
  const startedAt = performance.now();
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    const latencyMs = Math.round((performance.now() - startedAt) * 10) / 10;
    const [statusRows, variableRows] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ Variable_name: string; Value: string }>>(
        "SHOW GLOBAL STATUS WHERE Variable_name IN ('Threads_connected', 'Aborted_clients')",
      ),
      prisma.$queryRawUnsafe<Array<{ Variable_name: string; Value: string }>>(
        "SHOW GLOBAL VARIABLES WHERE Variable_name = 'max_connections'",
      ),
    ]);
    const status = new Map(statusRows.map((row) => [row.Variable_name, Number(row.Value)]));
    const variables = new Map(variableRows.map((row) => [row.Variable_name, Number(row.Value)]));
    return {
      up: true,
      latencyMs,
      connections: status.get('Threads_connected') ?? null,
      maxConnections: variables.get('max_connections') ?? null,
      abortedClients: status.get('Aborted_clients') ?? null,
    };
  } catch {
    return {
      up: false,
      latencyMs: null,
      connections: null,
      maxConnections: null,
      abortedClients: null,
    };
  }
}

async function readDbDigests(): Promise<NonNullable<CoreGuardSample['full']>['dbDigests']> {
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        DIGEST_TEXT: string | null;
        COUNT_STAR: bigint | number;
        SUM_TIMER_WAIT: bigint | number;
        AVG_TIMER_WAIT: bigint | number;
        SUM_ROWS_EXAMINED: bigint | number;
      }>
    >(
      `SELECT DIGEST_TEXT, COUNT_STAR, SUM_TIMER_WAIT, AVG_TIMER_WAIT, SUM_ROWS_EXAMINED
       FROM performance_schema.events_statements_summary_by_digest
       WHERE SCHEMA_NAME = DATABASE() AND DIGEST_TEXT IS NOT NULL
       ORDER BY SUM_TIMER_WAIT DESC
       LIMIT 15`,
    );
    const picoToMs = (value: bigint | number) =>
      Math.round((Number(value || 0) / 1_000_000_000) * 10) / 10;
    return rows.map((row) => ({
      digest: String(row.DIGEST_TEXT || '').slice(0, 1000),
      calls: Number(row.COUNT_STAR || 0),
      totalMs: picoToMs(row.SUM_TIMER_WAIT),
      averageMs: picoToMs(row.AVG_TIMER_WAIT),
      rowsExamined: Number(row.SUM_ROWS_EXAMINED || 0),
    }));
  } catch {
    return [];
  }
}

async function syntheticHealth() {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/health`, {
      signal: controller.signal,
      headers: { Host: 'estateos.pl', Connection: 'close' },
      cache: 'no-store',
    });
    return {
      ok: response.ok,
      status: response.status,
      latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
    };
  } catch {
    return { ok: false, status: null, latencyMs: null };
  } finally {
    clearTimeout(timer);
  }
}

async function readRuntimeWorkers() {
  const token = process.env.CORE_GUARD_TOKEN || process.env.CRON_SECRET;
  if (!token) return [];
  const byPid = new Map<number, CoreGuardSample['runtimeWorkers'][number]>();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(
        `http://127.0.0.1:${process.env.PORT || 3000}/api/internal/core-runtime`,
        {
          signal: controller.signal,
          headers: {
            Host: 'estateos.pl',
            Connection: 'close',
            'x-core-guard-token': token,
          },
          cache: 'no-store',
        },
      );
      if (response.ok) {
        const body = (await response.json()) as { runtime?: CoreGuardSample['runtimeWorkers'][number] };
        if (body.runtime?.pid) byPid.set(body.runtime.pid, body.runtime);
      }
    } catch {
      // A missing worker sample is visible as an incomplete pid set.
    } finally {
      clearTimeout(timer);
    }
  }
  return [...byPid.values()];
}

async function collectFullChecks(): Promise<NonNullable<CoreGuardSample['full']>> {
  const [diagnosis, system, deploySha, dbDigests] = await Promise.all([
    diagnoseServer(),
    collectCoreGuardSystemSnapshot(),
    run('git', ['-C', APP_ROOT, 'rev-parse', '--short', 'HEAD']),
    readDbDigests(),
  ]);
  const backupPath = process.env.CORE_GUARD_BACKUP_PATH;
  let backupAgeHours: number | null = null;
  if (backupPath) {
    try {
      backupAgeHours = Math.round(((Date.now() - fs.statSync(backupPath).mtimeMs) / 3_600_000) * 10) / 10;
    } catch {
      backupAgeHours = null;
    }
  }
  return {
    findings: diagnosis.findings,
    systemdFailed: system.systemd.failed,
    timers: system.systemd.timers,
    docker: system.docker.containers,
    listeningPorts: system.network.listeners,
    kernelWarnings: system.kernel.recentCriticalEvents,
    deploySha: deploySha.trim() || null,
    backupAgeHours,
    cron: system.cron,
    pressure: system.pressure,
    inodeUsage: system.inodeUsage,
    tls: system.tls,
    dbDigests,
  };
}

export async function collectCoreGuardSample(options?: { full?: boolean }): Promise<CoreGuardSample> {
  const [disk, processes, mariadb, nginx, database, synthetic, runtimeWorkers, kei] = await Promise.all([
    readDiskMetrics('/'),
    readPm2Processes(),
    readMariaDbStatus(),
    readNginxWindowMetrics(),
    readDbMetrics(),
    syntheticHealth(),
    readRuntimeWorkers(),
    getKeiWorkerQueueHealth().catch(() => null),
  ]);
  const cpu = readCpuMetrics();
  const memory = readMemoryMetrics();
  const swapUsedBytes = readSwapUsedBytes();
  database.up = database.up && mariadb.up;
  const web = processes.filter((process) => process.name === 'nieruchomosci');
  const critical = !database.up || !synthetic.ok || web.some((process) => process.status !== 'online');
  const warning =
    memory.percent >= 90 ||
    disk.percent >= 85 ||
    nginx.status5xx > 0 ||
    swapUsedBytes >= 512 * 1024 * 1024;
  return {
    collectedAt: new Date().toISOString(),
    host: os.hostname(),
    level: critical ? 'critical' : warning ? 'warning' : 'ok',
    cpu,
    memory,
    swapUsedBytes,
    disk,
    nginx,
    database,
    processes,
    kei,
    synthetic,
    runtimeWorkers,
    ...(options?.full ? { full: await collectFullChecks() } : {}),
  };
}

function candidateFromFinding(finding: ServerFinding): CoreGuardCandidate {
  return {
    fingerprint: `diagnose:${finding.id}`,
    type: finding.id,
    severity: finding.severity,
    title: finding.title,
    detail: finding.detail,
    evidence: Object.fromEntries((finding.evidence || []).map((item) => [item.label, item.value])),
    recommendedAction: finding.id === 'web-memory' ? 'reload-web' : undefined,
    autoFixable: ['junk', 'logs', 'build-leftovers'].includes(finding.id),
    requiredOccurrences: 1,
  };
}

export function evaluateCoreGuardSample(sample: CoreGuardSample): CoreGuardCandidate[] {
  const candidates: CoreGuardCandidate[] = [];
  const add = (candidate: CoreGuardCandidate, when: boolean) => {
    if (when) candidates.push(candidate);
  };
  const web = sample.processes.filter((process) => process.name === 'nieruchomosci');
  const worker = sample.processes.find((process) => process.name === 'kei-import-worker');
  const guard = sample.processes.find((process) => process.name === 'estateos-core-guard');
  const webRss = web.reduce((sum, process) => sum + process.memoryBytes, 0);

  add(
    {
      fingerprint: 'quick:synthetic-health',
      type: 'synthetic-health',
      severity: 'critical',
      title: 'Test syntetyczny WWW nie odpowiada',
      detail: 'Lokalny health-check EstateOS nie zakończył się poprawnie.',
      evidence: sample.synthetic,
      recommendedAction: 'reload-web',
    },
    !sample.synthetic.ok,
  );
  add(
    {
      fingerprint: 'quick:database',
      type: 'database',
      severity: 'critical',
      title: 'MariaDB nie odpowiada',
      detail: 'CORE Guard nie wykonał bezpiecznego SELECT 1.',
      evidence: sample.database,
      recommendedAction: 'start-mariadb',
    },
    !sample.database.up,
  );
  add(
    {
      fingerprint: 'quick:web-process',
      type: 'web-process',
      severity: 'critical',
      title: 'Worker WWW nie jest online',
      detail: 'Co najmniej jedna instancja nieruchomosci w PM2 jest poza stanem online.',
      evidence: { instances: web.map((process) => ({ id: process.id, status: process.status })) },
      recommendedAction: 'reload-web',
    },
    web.length < 2 || web.some((process) => process.status !== 'online'),
  );
  add(
    {
      fingerprint: 'quick:web-memory',
      type: 'web-memory',
      severity: webRss >= 1_800 * 1024 * 1024 ? 'critical' : 'warning',
      title: 'Rosnące użycie pamięci workerów WWW',
      detail: 'Suma RSS procesów Next.js przekroczyła stabilny budżet.',
      evidence: { totalRssBytes: webRss, workers: web.map((process) => process.memoryBytes) },
      recommendedAction: 'reload-web',
    },
    webRss >= 1_300 * 1024 * 1024,
  );
  add(
    {
      fingerprint: 'quick:nginx-5xx',
      type: 'nginx-5xx',
      severity: sample.nginx.status5xx >= 5 ? 'critical' : 'warning',
      title: 'Nginx rejestruje błędy 5xx',
      detail: 'W pięciominutowym oknie pojawiły się odpowiedzi serwera 5xx.',
      evidence: {
        status5xx: sample.nginx.status5xx,
        status502: sample.nginx.status502,
        status504: sample.nginx.status504,
      },
      recommendedAction: 'reload-web',
    },
    sample.nginx.status5xx >= 3,
  );
  add(
    {
      fingerprint: 'quick:memory-pressure',
      type: 'memory-pressure',
      severity: sample.memory.percent >= 95 ? 'critical' : 'warning',
      title: 'Presja pamięci systemowej',
      detail: 'Użycie RAM lub swapu przekroczyło bezpieczny próg.',
      evidence: { ramPercent: sample.memory.percent, swapUsedBytes: sample.swapUsedBytes },
      recommendedAction: 'reload-web',
    },
    sample.memory.percent >= 90 || sample.swapUsedBytes >= 1024 * 1024 * 1024,
  );
  add(
    {
      fingerprint: 'quick:disk',
      type: 'disk',
      severity: sample.disk.percent >= 95 ? 'critical' : 'warning',
      title: 'Mało miejsca na dysku',
      detail: 'Zajętość systemowego systemu plików przekroczyła próg Guard.',
      evidence: { percent: sample.disk.percent },
      recommendedAction: 'safe-cleanup',
      autoFixable: true,
    },
    sample.disk.percent >= 85,
  );
  add(
    {
      fingerprint: 'quick:kei-lease',
      type: 'kei-lease',
      severity: 'warning',
      title: 'Wygasł lease importu KEI',
      detail: 'Dedykowany worker może bezpiecznie odzyskać przerwane zadanie.',
      evidence: sample.kei || {},
      recommendedAction: 'recover-kei-lease',
      autoFixable: true,
    },
    Boolean(sample.kei?.expired),
  );
  add(
    {
      fingerprint: 'quick:kei-worker',
      type: 'kei-worker',
      severity: 'critical',
      title: 'Worker KEI nie działa',
      detail: 'Kolejka jest aktywna, ale proces kei-import-worker nie jest online.',
      evidence: { workerStatus: worker?.status || 'missing', queue: sample.kei },
      recommendedAction: 'restart-kei-worker',
    },
    Boolean((sample.kei?.queued || sample.kei?.running) && worker?.status !== 'online'),
  );
  add(
    {
      fingerprint: 'quick:guard-process',
      type: 'guard-process',
      severity: 'warning',
      title: 'PM2 nie raportuje CORE Guard',
      detail: 'Proces monitorujący nie występuje na liście PM2 lub nie jest online.',
      evidence: { status: guard?.status || 'missing' },
    },
    guard?.status !== 'online',
  );
  if (sample.full) {
    candidates.push(
      ...sample.full.findings
        .filter((finding) => finding.severity !== 'info')
        .map(candidateFromFinding),
    );
    for (const warning of sample.full.kernelWarnings) {
      if (!isKernelCriticalEvent(warning)) continue;
      candidates.push({
        fingerprint: 'full:kernel-watchdog',
        type: 'kernel-watchdog',
        severity: 'critical',
        title: 'Kernel zgłosił watchdog/OOM/lockup',
        detail: 'W logu kernela znaleziono zdarzenie wymagające korelacji z procesem lub hypervisorem.',
        evidence: { line: warning.slice(0, 1000) },
        requiredOccurrences: 1,
      });
      break;
    }
    if (sample.full.systemdFailed.length) {
      candidates.push({
        fingerprint: 'full:systemd-failed',
        type: 'systemd-failed',
        severity: 'warning',
        title: 'Usługa systemd jest w stanie failed',
        detail: 'Jedna lub więcej usług systemowych wymaga przeglądu.',
        evidence: { units: sample.full.systemdFailed },
        requiredOccurrences: 1,
      });
    }
    if (sample.full.tls.daysRemaining != null && sample.full.tls.daysRemaining < 14) {
      candidates.push({
        fingerprint: 'full:tls-expiry',
        type: 'tls-expiry',
        severity: sample.full.tls.daysRemaining < 3 ? 'critical' : 'warning',
        title: 'Certyfikat TLS wkrótce wygaśnie',
        detail: `Certyfikat ${sample.full.tls.host} ma ${sample.full.tls.daysRemaining} dni ważności.`,
        evidence: sample.full.tls,
        requiredOccurrences: 1,
      });
    }
    if (sample.full.backupAgeHours != null && sample.full.backupAgeHours > 48) {
      candidates.push({
        fingerprint: 'full:backup-stale',
        type: 'backup-stale',
        severity: sample.full.backupAgeHours > 96 ? 'critical' : 'warning',
        title: 'Backup EstateOS jest nieaktualny',
        detail: `Ostatnia zmiana backupu była ${sample.full.backupAgeHours} h temu.`,
        evidence: { backupAgeHours: sample.full.backupAgeHours },
        requiredOccurrences: 1,
      });
    }
  }
  return candidates;
}

export async function persistCoreGuardCycle(
  sample: CoreGuardSample,
  candidates: CoreGuardCandidate[],
  options?: { ignoreRestartDeltas?: boolean },
): Promise<void> {
  const web = sample.processes.filter((process) => process.name === 'nieruchomosci');
  const previousRows = (await prisma.$queryRawUnsafe(
    `SELECT payloadJson
     FROM CoreMetricSample
     WHERE host = ?
     ORDER BY collectedAt DESC
     LIMIT 1`,
    sample.host,
  )) as Array<{ payloadJson: string | null }>;
  try {
    const previousPayload = JSON.parse(previousRows[0]?.payloadJson || '{}') as {
      processes?: CoreGuardSample['processes'];
    };
    const restartTotals = (processes: CoreGuardSample['processes'] = []) => {
      const totals = new Map<string, number>();
      for (const process of processes) {
        if (process.kind !== 'daemon') continue;
        totals.set(process.name, (totals.get(process.name) || 0) + process.restarts);
      }
      return totals;
    };
    const previousRestarts = restartTotals(previousPayload.processes);
    const currentUptime = new Map<string, number>();
    for (const process of sample.processes) {
      if (process.kind !== 'daemon') continue;
      const previous = currentUptime.get(process.name);
      currentUptime.set(
        process.name,
        previous == null ? process.uptimeMs : Math.min(previous, process.uptimeMs),
      );
    }
    for (const [name, current] of restartTotals(sample.processes)) {
      const prior = previousRestarts.get(name);
      if (prior == null || current <= prior) continue;
      if (options?.ignoreRestartDeltas) continue;
      if ((currentUptime.get(name) || 0) < 12 * 60_000) continue;
      candidates.push({
        fingerprint: `quick:process-restarts:${name}`,
        type: 'process-restarts',
        severity: name === 'nieruchomosci' ? 'critical' : 'warning',
        title: `Proces ${name} uruchomił się ponownie`,
        detail: `Licznik restartów wzrósł z ${prior} do ${current}.`,
        evidence: { name, prior, current, delta: current - prior },
        recommendedAction: name === 'nieruchomosci' ? 'reload-web' : undefined,
        requiredOccurrences: 1,
      });
    }
  } catch {
    // Uszkodzona historyczna próbka nie blokuje bieżącego monitoringu.
  }
  const baselineRows = (await prisma.$queryRawUnsafe(
    `SELECT
       COUNT(*) AS samples,
       AVG(latencyP95Ms) AS latencyP95Ms,
       AVG(webRssBytes) AS webRssBytes,
       AVG(dbLatencyMs) AS dbLatencyMs
     FROM CoreMetricSample
     WHERE host = ?
       AND collectedAt >= DATE_SUB(NOW(3), INTERVAL 1 HOUR)
       AND level <> 'critical'`,
    sample.host,
  )) as Array<{
    samples: bigint | number;
    latencyP95Ms: number | string | null;
    webRssBytes: number | string | null;
    dbLatencyMs: number | string | null;
  }>;
  const baseline = baselineRows[0];
  if (Number(baseline?.samples || 0) >= 10) {
    const baselineLatency = Number(baseline.latencyP95Ms || 0);
    const baselineWebRss = Number(baseline.webRssBytes || 0);
    const baselineDbLatency = Number(baseline.dbLatencyMs || 0);
    if (
      sample.nginx.latencyMs.p95 != null &&
      sample.nginx.latencyMs.p95 > Math.max(800, baselineLatency * 3)
    ) {
      candidates.push({
        fingerprint: 'trend:nginx-latency',
        type: 'nginx-latency-trend',
        severity: sample.nginx.latencyMs.p95 > 3000 ? 'critical' : 'warning',
        title: 'Czas odpowiedzi odchylił się od stabilnej bazy',
        detail: 'p95 Nginx przekroczył trzykrotność godzinowej bazy.',
        evidence: { currentP95Ms: sample.nginx.latencyMs.p95, baselineP95Ms: baselineLatency },
        requiredOccurrences: 3,
      });
    }
    const currentWebRss = web.reduce((sum, process) => sum + process.memoryBytes, 0);
    if (currentWebRss > Math.max(1_300 * 1024 * 1024, baselineWebRss * 1.5)) {
      candidates.push({
        fingerprint: 'trend:web-memory',
        type: 'web-memory-trend',
        severity: 'warning',
        title: 'Pamięć WWW rośnie ponad stabilną bazę',
        detail: 'Suma RSS workerów przekroczyła 150% godzinowej bazy.',
        evidence: { currentWebRss, baselineWebRss },
        recommendedAction: 'reload-web',
        requiredOccurrences: 3,
      });
    }
    if (
      sample.database.latencyMs != null &&
      sample.database.latencyMs > Math.max(100, baselineDbLatency * 4)
    ) {
      candidates.push({
        fingerprint: 'trend:database-latency',
        type: 'database-latency-trend',
        severity: 'warning',
        title: 'Opóźnienie bazy odchyliło się od stabilnej bazy',
        detail: 'Czas SELECT 1 przekroczył czterokrotność godzinowej bazy.',
        evidence: { currentMs: sample.database.latencyMs, baselineMs: baselineDbLatency },
        requiredOccurrences: 3,
      });
    }
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO CoreMetricSample
      (collectedAt, host, level, cpuPercent, load1, memoryUsedBytes, memoryTotalBytes,
       swapUsedBytes, diskUsedBytes, diskTotalBytes, requestsPerMin, activeConnections,
       latencyP95Ms, upstreamLatencyP95Ms, status499, status5xx, dbLatencyMs,
       dbConnections, dbMaxConnections, dbAbortedClients, webRestarts, webRssBytes, payloadJson)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    new Date(sample.collectedAt),
    sample.host,
    sample.level,
    sample.cpu.percent,
    sample.cpu.load1,
    sample.memory.usedBytes,
    sample.memory.totalBytes,
    sample.swapUsedBytes,
    sample.disk.usedBytes,
    sample.disk.totalBytes,
    sample.nginx.requestsPerMin,
    sample.nginx.activeConnections,
    sample.nginx.latencyMs.p95,
    sample.nginx.upstreamLatencyMs.p95,
    sample.nginx.status499,
    sample.nginx.status5xx,
    sample.database.latencyMs,
    sample.database.connections,
    sample.database.maxConnections,
    sample.database.abortedClients,
    web.reduce((sum, process) => sum + process.restarts, 0),
    web.reduce((sum, process) => sum + process.memoryBytes, 0),
    JSON.stringify({
      nginx: sample.nginx,
      processes: sample.processes,
      kei: sample.kei,
      synthetic: sample.synthetic,
      runtimeWorkers: sample.runtimeWorkers,
      full: sample.full,
    }),
  );

  for (const candidate of candidates) {
    const required = Math.max(1, candidate.requiredOccurrences || 2);
    await prisma.$executeRawUnsafe(
      `INSERT INTO CoreIncident
        (id, fingerprint, type, severity, status, title, detail, evidenceJson,
         recommendedAction, autoFixable, occurrences, firstSeenAt, lastSeenAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE
         type = VALUES(type),
         severity = VALUES(severity),
         title = VALUES(title),
         detail = VALUES(detail),
         evidenceJson = VALUES(evidenceJson),
         recommendedAction = VALUES(recommendedAction),
         autoFixable = VALUES(autoFixable),
         occurrences = IF(resolvedAt IS NOT NULL, 1, occurrences + 1),
         status = IF(resolvedAt IS NOT NULL, ?, IF(occurrences + 1 >= ?, 'open', status)),
         firstSeenAt = IF(resolvedAt IS NOT NULL, NOW(3), firstSeenAt),
         lastSeenAt = NOW(3),
         resolvedAt = NULL,
         recoveryAlertAt = IF(status = 'resolved', NULL, recoveryAlertAt)`,
      randomUUID(),
      candidate.fingerprint,
      candidate.type,
      candidate.severity,
      required === 1 ? 'open' : 'pending',
      candidate.title,
      candidate.detail,
      JSON.stringify(candidate.evidence),
      candidate.recommendedAction || null,
      candidate.autoFixable ? 1 : 0,
      required === 1 ? 'open' : 'pending',
      required,
    );
  }

  const activeFingerprints = new Set(candidates.map((candidate) => candidate.fingerprint));
  const openRows = (await prisma.$queryRawUnsafe(
    `SELECT id, fingerprint
     FROM CoreIncident
     WHERE status IN ('open', 'pending')
       AND lastSeenAt < DATE_SUB(NOW(3), INTERVAL ${INCIDENT_RESOLVE_MINUTES} MINUTE)`,
  )) as Array<{ id: string; fingerprint: string }>;
  for (const row of openRows) {
    if (activeFingerprints.has(row.fingerprint)) continue;
    await prisma.$executeRawUnsafe(
      `UPDATE CoreIncident
       SET status = 'resolved', resolvedAt = NOW(3), cooldownUntil = NULL
       WHERE id = ? AND status IN ('open', 'pending')`,
      row.id,
    );
  }

  await prisma.$executeRawUnsafe(
    `DELETE FROM CoreMetricSample
     WHERE collectedAt < DATE_SUB(NOW(3), INTERVAL ${SAMPLE_RETENTION_DAYS} DAY)`,
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return entities[char];
  });
}

async function alertRecipients() {
  const configured = String(process.env.CORE_GUARD_ALERT_EMAILS || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
  const admins = (await prisma.$queryRawUnsafe(
    `SELECT id, email FROM User WHERE role = 'ADMIN' AND email IS NOT NULL`,
  )) as Array<{ id: number; email: string | null }>;
  return {
    emails: configured.length ? configured : admins.map((admin) => admin.email).filter((email): email is string => Boolean(email)),
    userIds: admins.map((admin) => Number(admin.id)).filter((id) => Number.isFinite(id)),
  };
}

async function sendGuardAlert(params: {
  title: string;
  detail: string;
  severity: string;
  recovery?: boolean;
}) {
  const recipients = await alertRecipients();
  const subject = params.recovery
    ? `[EstateOS CORE] Wróciło do normy: ${params.title}`
    : `[EstateOS CORE ${params.severity.toUpperCase()}] ${params.title}`;
  const link = `${String(process.env.NEXT_PUBLIC_APP_URL || 'https://estateos.pl').replace(/\/+$/, '')}/centrala/pamiec-i-serwer`;
  const html = `<h2>${escapeHtml(params.title)}</h2><p>${escapeHtml(params.detail)}</p><p><a href="${link}">Otwórz CORE Guard</a></p>`;
  await Promise.all([
    ...recipients.emails.map((to) => sendTransactionalEmail({ to, subject, html })),
    ...recipients.userIds.map((userId) =>
      notificationService
        .sendPushToUser(userId, {
          title: params.recovery ? 'CORE: wróciło do normy' : `CORE: ${params.title}`,
          body: params.detail,
          data: { type: 'core_guard', url: '/centrala/pamiec-i-serwer' },
        })
        .catch(() => undefined),
    ),
  ]);
}

export async function deliverCoreGuardAlerts() {
  const opened = (await prisma.$queryRawUnsafe(
    `SELECT id, title, detail, severity
     FROM CoreIncident
     WHERE status = 'open'
       AND severity = 'critical'
       AND (lastAlertAt IS NULL OR cooldownUntil < NOW(3))
     ORDER BY lastSeenAt DESC
     LIMIT 10`,
  )) as Array<{ id: string; title: string; detail: string; severity: string }>;
  for (const incident of opened) {
    await sendGuardAlert(incident);
    await prisma.$executeRawUnsafe(
      `UPDATE CoreIncident
       SET lastAlertAt = NOW(3),
           cooldownUntil = DATE_ADD(NOW(3), INTERVAL ${ALERT_COOLDOWN_MINUTES} MINUTE)
       WHERE id = ?`,
      incident.id,
    );
  }

  const recovered = (await prisma.$queryRawUnsafe(
    `SELECT id, title, detail, severity
     FROM CoreIncident
     WHERE status = 'resolved'
       AND lastAlertAt IS NOT NULL
       AND recoveryAlertAt IS NULL
     ORDER BY resolvedAt DESC
     LIMIT 10`,
  )) as Array<{ id: string; title: string; detail: string; severity: string }>;
  for (const incident of recovered) {
    await sendGuardAlert({ ...incident, recovery: true });
    await prisma.$executeRawUnsafe(
      `UPDATE CoreIncident SET recoveryAlertAt = NOW(3) WHERE id = ?`,
      incident.id,
    );
  }
}

function rangeHours(range: string) {
  if (range === '1h') return 1;
  if (range === '7d') return 24 * 7;
  return 24;
}

function jsonValue(value: unknown) {
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  return value;
}

export async function readCoreGuardDashboard(range = '24h') {
  const hours = rangeHours(range);
  const [samples, incidents, audits, detailRows] = await Promise.all([
    prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, collectedAt, level, cpuPercent, load1, memoryUsedBytes, memoryTotalBytes,
              swapUsedBytes, diskUsedBytes, diskTotalBytes, requestsPerMin, activeConnections,
              latencyP95Ms, status499, status5xx, dbLatencyMs, dbConnections, dbMaxConnections,
              webRestarts, webRssBytes
       FROM CoreMetricSample
       WHERE collectedAt >= DATE_SUB(NOW(3), INTERVAL ${hours} HOUR)
       ORDER BY collectedAt ASC`,
    ),
    prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, fingerprint, type, severity, status, title, detail, evidenceJson,
              recommendedAction, autoFixable, occurrences, firstSeenAt, lastSeenAt,
              lastAlertAt, acknowledgedAt, resolvedAt
       FROM CoreIncident
       WHERE lastSeenAt >= DATE_SUB(NOW(3), INTERVAL 7 DAY)
       ORDER BY FIELD(status, 'open', 'pending', 'resolved'), FIELD(severity, 'critical', 'warning', 'info'), lastSeenAt DESC
       LIMIT 200`,
    ),
    prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, incidentId, actionId, mode, actorUserId, status, detail, createdAt, finishedAt
       FROM CoreRemediationAudit
       ORDER BY createdAt DESC
       LIMIT 100`,
    ),
    prisma.$queryRawUnsafe<Array<{ payloadJson: string | null }>>(
      `SELECT payloadJson FROM CoreMetricSample ORDER BY collectedAt DESC LIMIT 1`,
    ),
  ]);
  const maxPoints = 720;
  const step = Math.max(1, Math.ceil(samples.length / maxPoints));
  const history = samples
    .filter((_, index) => index % step === 0 || index === samples.length - 1)
    .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, jsonValue(value)])));
  const normalizedIncidents = incidents.map((row) => {
    const base = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, jsonValue(value)]),
    );
    return {
      ...base,
      status: String(row.status || ''),
      severity: String(row.severity || 'info'),
      evidence: (() => {
        try {
          return JSON.parse(String(row.evidenceJson || '{}'));
        } catch {
          return {};
        }
      })(),
      evidenceJson: undefined,
    };
  });
  const normalizedAudits = audits.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, jsonValue(value)])),
  );
  const latest = history.at(-1) || null;
  let latestDetails: Record<string, unknown> | null = null;
  try {
    latestDetails = detailRows[0]?.payloadJson
      ? (JSON.parse(detailRows[0].payloadJson) as Record<string, unknown>)
      : null;
  } catch {
    latestDetails = null;
  }
  const active = normalizedIncidents.filter((incident) => incident.status === 'open');
  const score = Math.max(
    0,
    100 -
      active
        .filter((incident) => incident.severity !== 'info')
        .reduce(
        (sum, incident) =>
          sum + (incident.severity === 'critical' ? 35 : incident.severity === 'warning' ? 12 : 4),
        0,
      ),
  );
  return {
    ok: true,
    range: hours === 1 ? '1h' : hours === 168 ? '7d' : '24h',
    collectedAt: new Date().toISOString(),
    score,
    level: active.some((incident) => incident.severity === 'critical')
      ? 'critical'
      : active.some((incident) => incident.severity === 'warning')
        ? 'warning'
        : 'ok',
    latest,
    latestDetails,
    history,
    incidents: normalizedIncidents,
    audits: normalizedAudits,
  };
}

export async function acknowledgeCoreGuardIncident(id: string) {
  await prisma.$executeRawUnsafe(
    `UPDATE CoreIncident SET acknowledgedAt = NOW(3) WHERE id = ?`,
    id,
  );
}

export function coreGuardAppRoot() {
  return path.resolve(APP_ROOT);
}
