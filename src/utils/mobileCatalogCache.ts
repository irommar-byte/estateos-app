import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@estateos_mobile_catalog_v2';
const DEFAULT_TTL_MS = 300_000;

type CatalogCacheEntry = {
  at: number;
  etag?: string;
  offers: Record<string, unknown>[];
};

let memoryHit: CatalogCacheEntry | null = null;

function isFresh(at: number, maxAgeMs: number): boolean {
  if (!Number.isFinite(maxAgeMs)) return true;
  return Date.now() - at <= maxAgeMs;
}

export function readMobileCatalogMemory(maxAgeMs = DEFAULT_TTL_MS): Record<string, unknown>[] | null {
  if (!memoryHit) return null;
  if (!isFresh(memoryHit.at, maxAgeMs)) return null;
  return memoryHit.offers;
}

export function readMobileCatalogEtag(): string | null {
  return memoryHit?.etag ?? null;
}

export function writeMobileCatalogMemory(offers: Record<string, unknown>[], etag?: string) {
  memoryHit = { at: Date.now(), offers, etag };
}

export async function readMobileCatalogCache(maxAgeMs = DEFAULT_TTL_MS): Promise<Record<string, unknown>[] | null> {
  const mem = readMobileCatalogMemory(maxAgeMs);
  if (mem) return mem;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CatalogCacheEntry;
    if (!parsed?.at || !Array.isArray(parsed.offers) || parsed.offers.length === 0) return null;
    if (!isFresh(parsed.at, maxAgeMs)) {
      memoryHit = parsed;
      return null;
    }
    memoryHit = parsed;
    return parsed.offers;
  } catch {
    return null;
  }
}

/** Last persisted catalog even if TTL expired — paint immediately, then revalidate. */
export async function readMobileCatalogCacheStale(): Promise<Record<string, unknown>[] | null> {
  const fresh = await readMobileCatalogCache(Number.POSITIVE_INFINITY);
  if (fresh?.length) return fresh;
  if (memoryHit?.offers?.length) return memoryHit.offers;
  return null;
}

export async function readMobileCatalogCacheEtag(): Promise<string | null> {
  if (memoryHit?.etag) return memoryHit.etag;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CatalogCacheEntry;
    return parsed?.etag ?? null;
  } catch {
    return null;
  }
}

export async function writeMobileCatalogCache(offers: Record<string, unknown>[], etag?: string) {
  const entry: CatalogCacheEntry = { at: Date.now(), offers, etag };
  memoryHit = entry;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    /* quota / private mode */
  }
}
