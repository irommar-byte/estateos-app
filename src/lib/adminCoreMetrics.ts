import { execSync } from 'child_process';
import os from 'os';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { isAdminCoreOfflineFlagSet } from '@/lib/adminCoreControl';
import { readNginxWindowMetrics } from '@/lib/adminServerOps';
import { readRuntimePerformance } from '@/lib/runtimePerformance';

export type AdminCoreMetricsPayload = {
  collectedAt: string;
  host: string;
  uptimeSec: number;
  cpu: {
    percent: number;
    cores: number;
    load1: number;
    load5: number;
    load15: number;
  };
  memory: {
    usedBytes: number;
    totalBytes: number;
    percent: number;
  };
  disk: {
    usedBytes: number;
    totalBytes: number;
    percent: number;
  };
  process: {
    pid: number;
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    externalBytes: number;
    arrayBuffersBytes: number;
    eventLoopP50Ms: number;
    eventLoopP95Ms: number;
    eventLoopP99Ms: number;
  };
  network: {
    requestsPerMin: number;
    activeConnections: number;
    latencyP50Ms: number | null;
    latencyP95Ms: number | null;
    latencyP99Ms: number | null;
    upstreamLatencyP95Ms: number | null;
    status499: number;
    status5xx: number;
  };
  database: {
    poolActive: number | null;
    poolMax: number | null;
    latencyMs: number | null;
    abortedClients: number | null;
  };
  app: {
    offersPending: number;
    activeUsers: number;
    pushQueueDepth: number;
    radarPushActive: number;
  };
};

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function readDiskBytes(targetPath: string): { usedBytes: number; totalBytes: number; percent: number } {
  try {
    const out = execSync(`df -kP ${JSON.stringify(targetPath)} 2>/dev/null | tail -1`, {
      encoding: 'utf8',
      timeout: 2000,
    });
    const parts = out.trim().split(/\s+/);
    if (parts.length < 4) throw new Error('df parse');
    const totalBytes = Number(parts[1]) * 1024;
    const usedBytes = Number(parts[2]) * 1024;
    const percent = totalBytes > 0 ? round1((usedBytes / totalBytes) * 100) : 0;
    return { usedBytes, totalBytes, percent };
  } catch {
    return { usedBytes: 0, totalBytes: 0, percent: 0 };
  }
}

function readCpuMetrics() {
  const cores = os.cpus()?.length || 1;
  const [load1 = 0, load5 = 0, load15 = 0] = os.loadavg();
  const percent = round1(Math.min(100, (load1 / Math.max(cores, 1)) * 100));
  return {
    percent,
    cores,
    load1: round1(load1),
    load5: round1(load5),
    load15: round1(load15),
  };
}

function readMemoryMetrics() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = Math.max(0, totalBytes - freeBytes);
  const percent = totalBytes > 0 ? round1((usedBytes / totalBytes) * 100) : 0;
  return { usedBytes, totalBytes, percent };
}

function readProcessMetrics() {
  const runtime = readRuntimePerformance();
  return {
    pid: runtime.pid,
    rssBytes: runtime.memory.rssBytes,
    heapUsedBytes: runtime.memory.heapUsedBytes,
    heapTotalBytes: runtime.memory.heapTotalBytes,
    externalBytes: runtime.memory.externalBytes,
    arrayBuffersBytes: runtime.memory.arrayBuffersBytes,
    eventLoopP50Ms: runtime.eventLoop.p50Ms,
    eventLoopP95Ms: runtime.eventLoop.p95Ms,
    eventLoopP99Ms: runtime.eventLoop.p99Ms,
  };
}

async function measureDbLatencyMs(): Promise<number | null> {
  const started = Date.now();
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return Date.now() - started;
  } catch {
    return null;
  }
}

async function readDbConnectionMetrics(): Promise<{
  poolActive: number | null;
  poolMax: number | null;
  abortedClients: number | null;
}> {
  try {
    const [statusRows] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ Variable_name: string; Value: string }>>(
        "SHOW GLOBAL STATUS WHERE Variable_name IN ('Threads_connected', 'Aborted_clients')",
      ),
    ]);
    const status = new Map(statusRows.map((row) => [String(row.Variable_name), Number(row.Value)]));
    const finite = (value: number | undefined) => (Number.isFinite(value) ? value! : null);
    const prismaLimit = Number(process.env.PRISMA_CONNECTION_LIMIT);
    const perWorker = Number.isFinite(prismaLimit) ? Math.min(20, Math.max(1, Math.floor(prismaLimit))) : 4;
    return {
      poolActive: finite(status.get('Threads_connected')),
      poolMax: perWorker,
      abortedClients: finite(status.get('Aborted_clients')),
    };
  } catch {
    return { poolActive: null, poolMax: null, abortedClients: null };
  }
}

async function collectAppMetrics() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [offersPending, pushQueueDepth, radarPushActive, activeUsers] = await Promise.all([
    prisma.offer.count({ where: { status: 'PENDING' } }).catch(() => 0),
    prisma.notification.count({ where: { status: 'PENDING', isArchived: false } }).catch(() => 0),
    prisma.radarPreference.count({ where: { pushNotifications: true } }).catch(() => 0),
    prisma.device
      .groupBy({
        by: ['userId'],
        where: { isActive: true, updatedAt: { gte: since24h } },
      })
      .then((rows) => rows.length)
      .catch(() => 0),
  ]);

  return { offersPending, activeUsers, pushQueueDepth, radarPushActive };
}

export async function collectAdminCoreMetrics(): Promise<AdminCoreMetricsPayload> {
  const diskPath = process.env.CORE_METRICS_DISK_PATH || process.cwd();
  const [dbLatencyMs, dbConnections, app, nginx] = await Promise.all([
    measureDbLatencyMs(),
    readDbConnectionMetrics(),
    collectAppMetrics(),
    readNginxWindowMetrics(),
  ]);

  const memory = readMemoryMetrics();
  const disk = readDiskBytes(diskPath);

  return {
    collectedAt: new Date().toISOString(),
    host: os.hostname(),
    uptimeSec: Math.floor(os.uptime()),
    cpu: readCpuMetrics(),
    memory,
    disk,
    process: readProcessMetrics(),
    network: {
      requestsPerMin: nginx.requestsPerMin,
      activeConnections: nginx.activeConnections,
      latencyP50Ms: nginx.latencyMs.p50,
      latencyP95Ms: nginx.latencyMs.p95,
      latencyP99Ms: nginx.latencyMs.p99,
      upstreamLatencyP95Ms: nginx.upstreamLatencyMs.p95,
      status499: nginx.status499,
      status5xx: nginx.status5xx,
    },
    database: {
      poolActive: dbConnections.poolActive,
      poolMax: dbConnections.poolMax,
      latencyMs: dbLatencyMs,
      abortedClients: dbConnections.abortedClients,
    },
    app,
  };
}

function readPublicIpv4(): string | null {
  const ifaces = os.networkInterfaces();
  for (const list of Object.values(ifaces)) {
    for (const row of list || []) {
      const family = String(row.family);
      if ((family === 'IPv4' || family === '4') && !row.internal && row.address) {
        return row.address;
      }
    }
  }
  return null;
}

export async function collectAdminCoreMonitor() {
  const metrics = await collectAdminCoreMetrics();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [users, activeOffers, visitsTotalRows, uniqueAllRows, visits24hRows, unique24hRows] = await Promise.all([
    prisma.user.count().catch(() => 0),
    prisma.offer.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
    prisma.$queryRawUnsafe<Array<{ c: number | bigint }>>(`SELECT COUNT(*) AS c FROM PageVisitLog`).catch(() => [{ c: 0 }]),
    prisma
      .$queryRawUnsafe<Array<{ c: number | bigint }>>(`SELECT COUNT(DISTINCT ip) AS c FROM PageVisitLog WHERE ip IS NOT NULL AND TRIM(ip) <> ''`)
      .catch(() => [{ c: 0 }]),
    prisma
      .$queryRawUnsafe<Array<{ c: number | bigint }>>(`SELECT COUNT(*) AS c FROM PageVisitLog WHERE createdAt >= ?`, since24h)
      .catch(() => [{ c: 0 }]),
    prisma
      .$queryRawUnsafe<Array<{ c: number | bigint }>>(
        `SELECT COUNT(DISTINCT ip) AS c FROM PageVisitLog WHERE createdAt >= ? AND ip IS NOT NULL AND TRIM(ip) <> ''`,
        since24h,
      )
      .catch(() => [{ c: 0 }]),
  ]);

  return {
    collectedAt: metrics.collectedAt,
    host: metrics.host,
    publicIp: readPublicIpv4(),
    osUptimeSec: metrics.uptimeSec,
    processUptimeSec: Math.floor(process.uptime()),
    cpuPercent: metrics.cpu.percent,
    load1: metrics.cpu.load1,
    memoryPercent: metrics.memory.percent,
    memoryUsedBytes: metrics.memory.usedBytes,
    memoryTotalBytes: metrics.memory.totalBytes,
    diskPercent: metrics.disk.percent,
    dbLatencyMs: metrics.database.latencyMs,
    users,
    activeOffers,
    pendingOffers: metrics.app.offersPending,
    activeUsers24h: metrics.app.activeUsers,
    pageViews: Number(visitsTotalRows?.[0]?.c ?? 0),
    uniqueIps: Number(uniqueAllRows?.[0]?.c ?? 0),
    visits24h: Number(visits24hRows?.[0]?.c ?? 0),
    uniqueIps24h: Number(unique24hRows?.[0]?.c ?? 0),
  };
}

export async function handleAdminCoreMetricsGET(req: Request) {
  try {
    const gate = await requireMobileAdmin(req);
    if (!gate.ok) return gate.response;

    if (isAdminCoreOfflineFlagSet()) {
      return NextResponse.json(
        { success: false, state: 'offline', message: 'CORE jest w trybie OFFLINE (sterowanie admin).' },
        { status: 503, headers: NO_CACHE_HEADERS },
      );
    }

    const metrics = await collectAdminCoreMetrics();
    return NextResponse.json({ success: true, metrics }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('[admin/core/metrics]', error);
    const metrics = await collectAdminCoreMetrics().catch(() => null);
    if (metrics) {
      return NextResponse.json({ success: true, metrics }, { headers: NO_CACHE_HEADERS });
    }
    return NextResponse.json(
      { success: false, message: 'Nie udało się zebrać metryk CORE' },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }
}

export async function handleAdminCoreHealthGET(req: Request) {
  try {
    const gate = await requireMobileAdmin(req);
    if (!gate.ok) return gate.response;

    if (isAdminCoreOfflineFlagSet()) {
      return NextResponse.json(
        { success: false, status: 'offline', healthy: false, message: 'CORE jest w trybie OFFLINE (sterowanie admin).' },
        { status: 503, headers: NO_CACHE_HEADERS },
      );
    }

    const metrics = await collectAdminCoreMetrics();
    return NextResponse.json(
      {
        success: true,
        status: 'ok',
        healthy: true,
        collectedAt: metrics.collectedAt,
        host: metrics.host,
        uptimeSec: metrics.uptimeSec,
        databaseLatencyMs: metrics.database.latencyMs,
      },
      { headers: NO_CACHE_HEADERS },
    );
  } catch (error) {
    console.error('[admin/core/health]', error);
    return NextResponse.json(
      { success: false, status: 'degraded', healthy: false },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }
}
