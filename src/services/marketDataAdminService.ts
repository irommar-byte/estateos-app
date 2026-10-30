import { API_URL } from '../config/network';

export type IngestScheduleMode = 'off' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type IngestSchedule = { mode: IngestScheduleMode; weekday: number; hour: number; minute: number };
export type MarketDataState = {
  totals: { records: number; qualityOk: number; byKind: Record<string, number>; dataAsOf: string | null };
  running: { runId: number; startedAt: string; source: string } | null;
  progress: {
    runId: number | null;
    percent: number;
    phase: string;
    detail: string;
    kind: string | null;
    upserted: number;
    startedAt: string | null;
    updatedAt: string;
    done: boolean;
  } | null;
  lastRun: {
    runId: number;
    status: string;
    source: string;
    startedAt: string;
    finishedAt: string | null;
    upserted: number;
    fetched: number;
    error: string | null;
    added: number | null;
  } | null;
  schedule: IngestSchedule;
  nextRunAt: string | null;
  history: Array<{ runId: number; finishedAt: string; added: number; total: number; durationSec: number; status: string }>;
};

const headers = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });

async function parse(res: Response): Promise<MarketDataState> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String((data as { message?: string }).message || `HTTP ${res.status}`));
  return data as MarketDataState;
}

export async function fetchMarketDataState(token: string): Promise<MarketDataState> {
  return parse(await fetch(`${API_URL}/api/mobile/v1/admin/market-data`, { headers: headers(token) }));
}

export async function startMarketDataUpdate(token: string): Promise<MarketDataState> {
  return parse(
    await fetch(`${API_URL}/api/mobile/v1/admin/market-data`, { method: 'POST', headers: headers(token), body: JSON.stringify({ action: 'run' }) }),
  );
}

export async function stopMarketDataUpdate(token: string): Promise<MarketDataState> {
  return parse(
    await fetch(`${API_URL}/api/mobile/v1/admin/market-data`, { method: 'POST', headers: headers(token), body: JSON.stringify({ action: 'stop' }) }),
  );
}

export async function saveMarketDataSchedule(token: string, schedule: IngestSchedule): Promise<MarketDataState> {
  return parse(
    await fetch(`${API_URL}/api/mobile/v1/admin/market-data`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ action: 'schedule', schedule }),
    }),
  );
}
