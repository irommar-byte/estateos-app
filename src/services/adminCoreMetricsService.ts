import { API_URL } from '../config/network';
import type { AdminCoreMetrics, AdminCoreMetricsResponse } from '../contracts/adminCoreContract';

/** Kanoniczny endpoint (produkcja: commit 0a43beaa). */
export const ADMIN_CORE_METRICS_PATH = '/api/mobile/v1/admin/core/metrics';
export const ADMIN_CORE_HEALTH_PATH = '/api/mobile/v1/admin/core/health';

/** POST start/stop — wymaga ADMIN_CORE_CONTROL_ENABLED=1 na serwerze EstateOS. */
export const ADMIN_CORE_SERVER_CONTROL_ENABLED = true;

export const ADMIN_CORE_START_PATH = '/api/mobile/v1/admin/core/start';
export const ADMIN_CORE_STOP_PATH = '/api/mobile/v1/admin/core/stop';
export const ADMIN_CORE_LOGS_PATH = '/api/mobile/v1/admin/core/logs';

const LOG_POLL_LINES = 100;

const METRIC_ENDPOINT_FALLBACKS = [
  ADMIN_CORE_HEALTH_PATH,
  '/api/admin/core/metrics',
  '/api/admin/core/health',
];

function hasCorePayload(payload: Record<string, unknown>): boolean {
  return (
    typeof payload.collectedAt === 'string' ||
    typeof payload.host === 'string' ||
    payload.cpu != null ||
    payload.memory != null ||
    payload.disk != null
  );
}

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const bytesPair = (used: unknown, total: unknown) => {
  const t = Math.max(0, num(total));
  const u = Math.max(0, Math.min(t || num(used), num(used)));
  const totalBytes = t > 0 ? t : u;
  const usedBytes = u;
  const percent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;
  return { usedBytes, totalBytes, percent };
};

export function formatBytesShort(bytes: number): string {
  const b = Math.max(0, bytes);
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${Math.round(b)} B`;
}

export function formatUptime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

function pickPayload(json: AdminCoreMetricsResponse): Record<string, unknown> {
  const raw = json.metrics ?? json.core ?? json.data ?? json;
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

export function normalizeAdminCoreMetrics(raw: Record<string, unknown>, live: boolean): AdminCoreMetrics {
  const cpuRaw = (raw.cpu ?? raw.processor ?? {}) as Record<string, unknown>;
  const memRaw = (raw.memory ?? raw.ram ?? raw.mem ?? {}) as Record<string, unknown>;
  const diskRaw = (raw.disk ?? raw.storage ?? {}) as Record<string, unknown>;
  const procRaw = (raw.process ?? raw.node ?? {}) as Record<string, unknown>;
  const netRaw = (raw.network ?? raw.net ?? {}) as Record<string, unknown>;
  const dbRaw = (raw.database ?? raw.db ?? {}) as Record<string, unknown>;
  const appRaw = (raw.app ?? raw.application ?? {}) as Record<string, unknown>;

  const memory = bytesPair(
    memRaw.usedBytes ?? memRaw.used ?? memRaw.usedMb != null ? num(memRaw.usedMb) * 1024 ** 2 : undefined,
    memRaw.totalBytes ?? memRaw.total ?? memRaw.totalMb != null ? num(memRaw.totalMb) * 1024 ** 2 : undefined,
  );
  if (memRaw.percent != null) memory.percent = num(memRaw.percent);

  const disk = bytesPair(
    diskRaw.usedBytes ?? diskRaw.used ?? diskRaw.usedGb != null ? num(diskRaw.usedGb) * 1024 ** 3 : undefined,
    diskRaw.totalBytes ?? diskRaw.total ?? diskRaw.totalGb != null ? num(diskRaw.totalGb) * 1024 ** 3 : undefined,
  );
  if (diskRaw.percent != null) disk.percent = num(diskRaw.percent);

  return {
    collectedAt: String(raw.collectedAt ?? raw.timestamp ?? new Date().toISOString()),
    host: String(raw.host ?? raw.hostname ?? 'estateos-core'),
    uptimeSec: num(raw.uptimeSec ?? raw.uptime ?? raw.uptimeSeconds),
    cpu: {
      percent: Math.max(0, Math.min(100, num(cpuRaw.percent ?? cpuRaw.usage ?? raw.cpuPercent))),
      cores: Math.max(1, num(cpuRaw.cores ?? raw.cpuCores, 4)),
      load1: cpuRaw.load1 != null ? num(cpuRaw.load1) : undefined,
      load5: cpuRaw.load5 != null ? num(cpuRaw.load5) : undefined,
      load15: cpuRaw.load15 != null ? num(cpuRaw.load15) : undefined,
    },
    memory,
    disk,
    process: {
      rssBytes: num(procRaw.rssBytes ?? procRaw.rss ?? procRaw.rssMb != null ? num(procRaw.rssMb) * 1024 ** 2 : 0),
      heapUsedBytes: num(
        procRaw.heapUsedBytes ?? procRaw.heapUsed ?? procRaw.heapUsedMb != null ? num(procRaw.heapUsedMb) * 1024 ** 2 : 0,
      ),
      heapTotalBytes: num(
        procRaw.heapTotalBytes ?? procRaw.heapTotal ?? procRaw.heapTotalMb != null ? num(procRaw.heapTotalMb) * 1024 ** 2 : 0,
      ),
    },
    network: {
      requestsPerMin: num(netRaw.requestsPerMin ?? netRaw.rpm ?? raw.requestsPerMin),
      activeConnections: num(netRaw.activeConnections ?? netRaw.connections ?? raw.activeConnections),
    },
    database: {
      poolActive: num(dbRaw.poolActive ?? dbRaw.active ?? dbRaw.connections),
      poolMax: num(dbRaw.poolMax ?? dbRaw.max, 20),
      latencyMs: num(dbRaw.latencyMs ?? dbRaw.latency ?? dbRaw.pingMs),
    },
    app: {
      offersPending: num(appRaw.offersPending ?? appRaw.pendingOffers),
      activeUsers: num(appRaw.activeUsers ?? appRaw.usersOnline),
      pushQueueDepth: num(appRaw.pushQueueDepth ?? appRaw.pushQueue),
      radarPushActive: num(appRaw.radarPushActive ?? appRaw.radarActive),
    },
    live,
  };
}

/** Symulacja „na żywo” gdy backend jeszcze nie wystawia metryk (delikatne fluktuacje). */
export function buildPreviewAdminCoreMetrics(seed = Date.now()): AdminCoreMetrics {
  const t = seed / 1000;
  const wave = (o: number, a: number, f: number) => o + Math.sin(t * f) * a;
  const memTotal = 16 * 1024 ** 3;
  const diskTotal = 256 * 1024 ** 3;
  const memUsed = memTotal * (0.42 + Math.sin(t * 0.7) * 0.08);
  const diskUsed = diskTotal * (0.61 + Math.sin(t * 0.25) * 0.03);

  return normalizeAdminCoreMetrics(
    {
      collectedAt: new Date().toISOString(),
      host: 'estateos.pl (podgląd)',
      uptimeSec: 86400 * 12 + (t % 3600),
      cpu: {
        percent: Math.max(4, Math.min(92, wave(38, 22, 0.9))),
        cores: 4,
        load1: wave(0.42, 0.28, 1.1),
        load5: wave(0.38, 0.18, 0.6),
        load15: wave(0.35, 0.12, 0.35),
      },
      memory: { usedBytes: memUsed, totalBytes: memTotal },
      disk: { usedBytes: diskUsed, totalBytes: diskTotal },
      process: {
        rssMb: wave(420, 80, 0.5),
        heapUsedMb: wave(180, 40, 0.8),
        heapTotalMb: 256,
      },
      network: { requestsPerMin: Math.round(wave(120, 45, 1.3)), activeConnections: Math.round(wave(38, 12, 0.7)) },
      database: { poolActive: Math.round(wave(6, 3, 1.1)), poolMax: 20, latencyMs: Math.round(wave(14, 8, 1.5)) },
      app: {
        offersPending: Math.round(wave(3, 2, 0.4)),
        activeUsers: Math.round(wave(24, 10, 0.55)),
        pushQueueDepth: Math.round(wave(5, 4, 0.9)),
        radarPushActive: Math.round(wave(18, 6, 0.45)),
      },
    },
    false,
  );
}

export class AdminCoreMetricsError extends Error {
  constructor(
    message: string,
    public readonly code: 'unauthorized' | 'forbidden' | 'unavailable',
  ) {
    super(message);
    this.name = 'AdminCoreMetricsError';
  }
}

async function fetchCoreFromPath(
  path: string,
  headers: Record<string, string>,
): Promise<AdminCoreMetrics | null> {
  const res = await fetch(`${API_URL}${path}`, { headers, cache: 'no-store' });
  const json = (await res.json().catch(() => ({}))) as AdminCoreMetricsResponse;

  if (res.status === 401) {
    throw new AdminCoreMetricsError('Sesja wygasła — zaloguj się ponownie jako administrator.', 'unauthorized');
  }
  if (res.status === 403) {
    throw new AdminCoreMetricsError('Brak uprawnień ADMIN do EstateOS™ CORE.', 'forbidden');
  }
  if (!res.ok) return null;

  const payload = pickPayload(json);
  if (!hasCorePayload(payload)) return null;
  return normalizeAdminCoreMetrics(payload, true);
}

export async function fetchAdminCoreMetrics(
  token: string,
  options?: { allowPreviewFallback?: boolean },
): Promise<AdminCoreMetrics> {
  const allowPreviewFallback = options?.allowPreviewFallback ?? true;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  };

  try {
    const primary = await fetchCoreFromPath(ADMIN_CORE_METRICS_PATH, headers);
    if (primary) return primary;
  } catch (e) {
    if (e instanceof AdminCoreMetricsError) throw e;
  }

  for (const path of METRIC_ENDPOINT_FALLBACKS) {
    try {
      const m = await fetchCoreFromPath(path, headers);
      if (m) return m;
    } catch (e) {
      if (e instanceof AdminCoreMetricsError) throw e;
    }
  }

  if (allowPreviewFallback) return buildPreviewAdminCoreMetrics();
  throw new AdminCoreMetricsError('Serwer CORE chwilowo niedostępny.', 'unavailable');
}

export type AdminCoreControlState = 'starting' | 'stopping' | 'online' | 'offline';

export type AdminCoreControlResult = {
  state: AdminCoreControlState;
  message?: string;
};

/** Start/stop PM2 (backend: POST /api/mobile/v1/admin/core/start|stop). */
export async function controlAdminCoreServer(
  token: string,
  action: 'start' | 'stop',
): Promise<AdminCoreControlResult> {
  if (!ADMIN_CORE_SERVER_CONTROL_ENABLED) {
    throw new AdminCoreMetricsError(
      'Sterowanie serwerem (start/stop) jest wyłączone w aplikacji.',
      'unavailable',
    );
  }

  const path = action === 'start' ? ADMIN_CORE_START_PATH : ADMIN_CORE_STOP_PATH;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  };

  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body: '{}' });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (res.status === 401) {
    throw new AdminCoreMetricsError('Sesja wygasła — zaloguj się ponownie jako administrator.', 'unauthorized');
  }
  if (res.status === 403) {
    throw new AdminCoreMetricsError(
      String(json.message || 'Brak uprawnień lub sterowanie CORE wyłączone na serwerze.'),
      'forbidden',
    );
  }
  if (!res.ok || json.success === false) {
    throw new AdminCoreMetricsError(
      String(json.message || `Nie udało się wykonać akcji "${action}" na CORE.`),
      'unavailable',
    );
  }

  const state = String(json.state || (action === 'start' ? 'starting' : 'stopping')) as AdminCoreControlState;
  return {
    state: ['starting', 'stopping', 'online', 'offline'].includes(state) ? state : action === 'start' ? 'starting' : 'stopping',
    message: typeof json.message === 'string' ? json.message : undefined,
  };
}

export type AdminCoreLogsResult = {
  logs: string;
  pm2?: string;
  collectedAt?: string;
};

/** Ostatnie linie logów PM2 (live polling w panelu CORE). */
export async function fetchAdminCoreLogs(token: string, lines = LOG_POLL_LINES): Promise<AdminCoreLogsResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  };

  const res = await fetch(`${API_URL}${ADMIN_CORE_LOGS_PATH}?lines=${lines}`, { headers, cache: 'no-store' });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (res.status === 401) {
    throw new AdminCoreMetricsError('Sesja wygasła — zaloguj się ponownie jako administrator.', 'unauthorized');
  }
  if (res.status === 403) {
    throw new AdminCoreMetricsError(String(json.message || 'Brak dostępu do logów CORE.'), 'forbidden');
  }
  if (!res.ok || json.success === false) {
    throw new AdminCoreMetricsError(String(json.message || 'Nie udało się pobrać logów PM2.'), 'unavailable');
  }

  return {
    logs: String(json.logs ?? ''),
    pm2: typeof json.pm2 === 'string' ? json.pm2 : undefined,
    collectedAt: typeof json.collectedAt === 'string' ? json.collectedAt : undefined,
  };
}
