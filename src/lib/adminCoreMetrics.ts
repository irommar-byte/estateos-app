import { execSync } from 'child_process';
import os from 'os';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';

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
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
  };
  network: {
    requestsPerMin: number;
    activeConnections: number;
  };
  database: {
    poolActive: number | null;
    poolMax: number | null;
    latencyMs: number | null;
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
  const mem = process.memoryUsage();
  return {
    rssBytes: mem.rss,
    heapUsedBytes: mem.heapUsed,
    heapTotalBytes: mem.heapTotal,
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
  const [dbLatencyMs, app] = await Promise.all([measureDbLatencyMs(), collectAppMetrics()]);

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
      requestsPerMin: 0,
      activeConnections: 0,
    },
    database: {
      poolActive: null,
      poolMax: null,
      latencyMs: dbLatencyMs,
    },
    app,
  };
}

export async function handleAdminCoreMetricsGET(req: Request) {
  try {
    const gate = await requireMobileAdmin(req);
    if (!gate.ok) return gate.response;

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
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function handleAdminCoreHealthGET(req: Request) {
  try {
    const gate = await requireMobileAdmin(req);
    if (!gate.ok) return gate.response;

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
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('[admin/core/health]', error);
    return NextResponse.json(
      { success: false, status: 'degraded', healthy: false },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
