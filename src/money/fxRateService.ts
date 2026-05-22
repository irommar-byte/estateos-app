import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/network';
import { DEFAULT_EUR_PLN_RATE } from './constants';
import {
  FX_DAILY_REFRESH_HOUR_WARSAW,
  getFxSessionKey,
  isFxCacheValidForSession,
  msUntilNextFxRefresh,
} from './fxSchedule';
import type { FxRateSnapshot } from './types';

const CACHE_KEY = '@estateos_fx_eur_pln_v1';

type Cached = FxRateSnapshot & {
  fetchedAt: number;
  sessionKey: string;
};

export type FxRateSnapshotWithSession = FxRateSnapshot & {
  sessionKey: string;
};

let inFlight: Promise<FxRateSnapshotWithSession> | null = null;
let dailyTimer: ReturnType<typeof setTimeout> | null = null;
let dailyInterval: ReturnType<typeof setInterval> | null = null;

async function readCache(): Promise<Cached | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    if (!c?.rate || c.rate <= 0) return null;
    return c;
  } catch {
    return null;
  }
}

async function writeCache(snap: FxRateSnapshotWithSession): Promise<void> {
  try {
    const payload: Cached = {
      ...snap,
      fetchedAt: Date.now(),
      sessionKey: snap.sessionKey,
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // noop
  }
}

async function fetchFromBackend(): Promise<FxRateSnapshot | null> {
  const paths = ['/api/fx/eur-pln', '/api/mobile/v1/fx/eur-pln'];
  for (const path of paths) {
    try {
      const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) continue;
      const rate = Number(data?.rate ?? data?.eurPln ?? data?.EUR_PLN);
      if (!Number.isFinite(rate) || rate <= 0) continue;
      return {
        rate,
        date: String(data?.date || data?.rateDate || new Date().toISOString().slice(0, 10)),
        source: String(data?.source || 'NBP'),
      };
    } catch {
      // następny URL
    }
  }
  return null;
}

/** Oficjalne API NBP (tabela A) — gdy backend jeszcze nie ma endpointu. */
async function fetchFromNbp(): Promise<FxRateSnapshot | null> {
  try {
    const res = await fetch('https://api.nbp.pl/api/exchangerates/rates/a/eur/?format=json', {
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    const row = Array.isArray(data?.rates) ? data.rates[0] : null;
    const rate = Number(row?.mid);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    return {
      rate,
      date: String(row?.effectiveDate || new Date().toISOString().slice(0, 10)),
      source: 'NBP',
    };
  } catch {
    return null;
  }
}

async function fetchFreshRate(): Promise<FxRateSnapshotWithSession> {
  const sessionKey = getFxSessionKey();
  const fromApi = (await fetchFromBackend()) || (await fetchFromNbp());
  if (fromApi) {
    const snap: FxRateSnapshotWithSession = { ...fromApi, sessionKey };
    await writeCache(snap);
    return snap;
  }

  const cached = await readCache();
  if (cached && isFxCacheValidForSession(cached.sessionKey)) {
    return { rate: cached.rate, date: cached.date, source: cached.source, sessionKey: cached.sessionKey };
  }

  return {
    rate: DEFAULT_EUR_PLN_RATE,
    date: new Date().toISOString().slice(0, 10),
    source: 'fallback',
    sessionKey,
  };
}

/**
 * Kurs EUR/PLN — cache ważny do następnej granicy **08:00 Europe/Warsaw**.
 * Po tej godzinie (lub przy `force`) pobiera świeży kurs z API / NBP.
 */
export async function getEurPlnRate(options?: {
  force?: boolean;
}): Promise<FxRateSnapshotWithSession> {
  const sessionKey = getFxSessionKey();
  if (!options?.force) {
    const cached = await readCache();
    if (cached && isFxCacheValidForSession(cached.sessionKey)) {
      return {
        rate: cached.rate,
        date: cached.date,
        source: cached.source || 'cache',
        sessionKey: cached.sessionKey,
      };
    }
  }

  if (!inFlight) {
    inFlight = fetchFreshRate().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/**
 * Planuje odświeżenie o kolejnej 08:00 (Warszawa) + co minutę sprawdza zmianę sesji
 * (gdy aplikacja działa w tle na pierwszym planie po przejściu przez północ/8:00).
 */
export function startFxRateDailyScheduler(onRefresh: () => void): void {
  const scheduleNext = () => {
    if (dailyTimer) clearTimeout(dailyTimer);
    dailyTimer = setTimeout(() => {
      onRefresh();
      scheduleNext();
    }, msUntilNextFxRefresh());
  };

  scheduleNext();

  if (!dailyInterval) {
    let lastKey = getFxSessionKey();
    dailyInterval = setInterval(() => {
      const key = getFxSessionKey();
      if (key !== lastKey) {
        lastKey = key;
        onRefresh();
      }
    }, 60_000);
  }
}

export function stopFxRateDailyScheduler(): void {
  if (dailyTimer) clearTimeout(dailyTimer);
  if (dailyInterval) clearInterval(dailyInterval);
  dailyTimer = null;
  dailyInterval = null;
}

export { FX_DAILY_REFRESH_HOUR_WARSAW };
