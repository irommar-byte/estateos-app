import fs from 'fs';
import path from 'path';

export type EurPlnRate = {
  rate: number;
  date: string;
  source: 'NBP';
};

const NBP_URL = 'https://api.nbp.pl/api/exchangerates/rates/a/eur/?format=json';
const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'nbp-eur-pln.json');

type RateCache = {
  rate: number;
  date: string;
  fetchedAt: string;
};

let memoryCache: RateCache | null = null;

function readDiskCache(): RateCache | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as RateCache;
    if (!parsed?.rate || !parsed?.date) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDiskCache(entry: RateCache) {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(entry), 'utf8');
  } catch {
    // cache best-effort
  }
}

function isSameUtcDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

async function fetchFromNbp(): Promise<RateCache> {
  const res = await fetch(NBP_URL, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 86400 },
  });
  if (!res.ok) {
    throw new Error(`NBP HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    rates?: Array<{ effectiveDate?: string; mid?: number }>;
  };
  const latest = json?.rates?.[0];
  const rate = Number(latest?.mid);
  const date = String(latest?.effectiveDate || '').trim();
  if (!Number.isFinite(rate) || rate <= 0 || !date) {
    throw new Error('NBP: brak kursu EUR/PLN');
  }
  return {
    rate,
    date,
    fetchedAt: new Date().toISOString(),
  };
}

/** Kurs średni NBP tabela A (EUR/PLN), cache dzienny (pamięć + plik). */
export async function getNbpEurPlnRate(): Promise<EurPlnRate> {
  const today = new Date().toISOString().slice(0, 10);
  if (memoryCache && isSameUtcDay(memoryCache.fetchedAt, today)) {
    return { rate: memoryCache.rate, date: memoryCache.date, source: 'NBP' };
  }

  const disk = readDiskCache();
  if (disk && isSameUtcDay(disk.fetchedAt, today)) {
    memoryCache = disk;
    return { rate: disk.rate, date: disk.date, source: 'NBP' };
  }

  try {
    const fresh = await fetchFromNbp();
    memoryCache = fresh;
    writeDiskCache(fresh);
    return { rate: fresh.rate, date: fresh.date, source: 'NBP' };
  } catch (error) {
    if (disk) {
      return { rate: disk.rate, date: disk.date, source: 'NBP' };
    }
    if (memoryCache) {
      return { rate: memoryCache.rate, date: memoryCache.date, source: 'NBP' };
    }
    throw error;
  }
}
