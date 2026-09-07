import { API_URL } from '../config/network';
import type {
  CoreDiagnoseReport,
  CoreLogAppName,
  CoreLogStream,
  CoreLogsResult,
  CoreMariaDbStatus,
  CoreOptimizeResult,
  CorePm2Process,
  CoreProductionSnapshot,
} from '../contracts/adminCoreOpsContract';

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data.success === false || data.ok === false) {
    throw new Error(
      String(data.error || data.message || `HTTP ${res.status}`),
    );
  }
  return data as T;
}

export async function fetchCoreDiagnose(token: string): Promise<CoreDiagnoseReport> {
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/core/diagnose`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const data = await parseJson<CoreDiagnoseReport>(res);
  return {
    ...data,
    score: Number(data.score ?? (data.healthy ? 100 : 70)),
    findings: Array.isArray(data.findings) ? data.findings : [],
    summary: String(data.summary || ''),
    level: data.level === 'critical' || data.level === 'warning' ? data.level : 'ok',
    healthy: Boolean(data.healthy),
    collectedAt: String(data.collectedAt || new Date().toISOString()),
  };
}

export async function runCoreOptimize(token: string): Promise<CoreOptimizeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 70_000);
  try {
    const res = await fetch(`${API_URL}/api/mobile/v1/admin/core/optimize`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: '{}',
      signal: controller.signal,
    });
    const data = await parseJson<CoreOptimizeResult>(res);
    return {
      ok: data.ok !== false,
      actions: Array.isArray(data.actions) ? data.actions : [],
      before: data.before,
      after: data.after ?? null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Optymalizacja przekroczyła 70 s.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchCoreProcesses(
  token: string,
): Promise<{ processes: CorePm2Process[]; mariadb: CoreMariaDbStatus }> {
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/core/processes`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const data = await parseJson<{ processes?: CorePm2Process[]; mariadb?: CoreMariaDbStatus }>(res);
  return {
    processes: Array.isArray(data.processes) ? data.processes : [],
    mariadb: data.mariadb || { name: 'mariadb', status: 'unknown', up: false },
  };
}

export async function controlCoreProcess(
  token: string,
  name: string,
  action: 'start' | 'stop' | 'restart' | 'reload',
): Promise<{ ok: boolean; output?: string }> {
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/core/processes`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, action }),
  });
  return parseJson(res);
}

export async function fetchCoreProduction(token: string): Promise<CoreProductionSnapshot> {
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/core/production`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  return parseJson<CoreProductionSnapshot>(res);
}

export async function fetchCoreOpsLogs(
  token: string,
  opts?: { name?: CoreLogAppName | string; stream?: CoreLogStream; lines?: number },
): Promise<CoreLogsResult> {
  const q = new URLSearchParams({
    name: String(opts?.name || 'nieruchomosci'),
    stream: String(opts?.stream || 'both'),
    lines: String(opts?.lines ?? 250),
  });
  const res = await fetch(`${API_URL}/api/mobile/v1/admin/core/logs?${q}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const data = await parseJson<CoreLogsResult>(res);
  return {
    logs: String(data.logs || ''),
    name: String(data.name || opts?.name || 'nieruchomosci'),
    stream: data.stream === 'out' || data.stream === 'error' ? data.stream : 'both',
    lines: Number(data.lines || 0),
    apps: data.apps,
    pm2: data.pm2,
    collectedAt: data.collectedAt,
  };
}
