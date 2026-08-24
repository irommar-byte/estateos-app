import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@estateos_mobile_catalog_v1';
const DEFAULT_TTL_MS = 90_000;

type CatalogCacheEntry = {
  at: number;
  offers: Record<string, unknown>[];
};

let memoryHit: CatalogCacheEntry | null = null;

export function readMobileCatalogMemory(maxAgeMs = DEFAULT_TTL_MS): Record<string, unknown>[] | null {
  if (!memoryHit) return null;
  if (Date.now() - memoryHit.at > maxAgeMs) return null;
  return memoryHit.offers;
}

export function writeMobileCatalogMemory(offers: Record<string, unknown>[]) {
  memoryHit = { at: Date.now(), offers };
}

export async function readMobileCatalogCache(maxAgeMs = DEFAULT_TTL_MS): Promise<Record<string, unknown>[] | null> {
  const mem = readMobileCatalogMemory(maxAgeMs);
  if (mem) return mem;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CatalogCacheEntry;
    if (!parsed?.at || !Array.isArray(parsed.offers)) return null;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memoryHit = parsed;
    return parsed.offers;
  } catch {
    return null;
  }
}

export async function writeMobileCatalogCache(offers: Record<string, unknown>[]) {
  const entry: CatalogCacheEntry = { at: Date.now(), offers };
  memoryHit = entry;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    /* quota / private mode */
  }
}
