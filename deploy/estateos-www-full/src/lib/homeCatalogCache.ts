/** In-memory + session cache for homepage catalog fetches (avoids no-store thrash on scroll remounts). */

type CacheEntry<T> = { at: number; data: T };

const memory = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 90_000;

function readSession<T>(key: string, ttlMs: number): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > ttlMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeSession<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data } satisfies CacheEntry<T>));
  } catch {
    /* quota / private mode */
  }
}

export async function fetchHomeCatalogJson<T>(
  url: string,
  init?: RequestInit,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const cacheKey = `eos:home-catalog:${url}`;
  const mem = memory.get(cacheKey) as CacheEntry<T> | undefined;
  if (mem && Date.now() - mem.at < ttlMs) return mem.data;

  const sessionHit = readSession<T>(cacheKey, ttlMs);
  if (sessionHit != null) {
    memory.set(cacheKey, { at: Date.now(), data: sessionHit });
    return sessionHit;
  }

  const res = await fetch(url, {
    ...init,
    // Allow browser HTTP cache; homepage does not need hard no-store.
    cache: init?.cache ?? "default",
  });
  if (!res.ok) throw new Error(`home catalog ${url} → ${res.status}`);
  const data = (await res.json()) as T;
  memory.set(cacheKey, { at: Date.now(), data });
  writeSession(cacheKey, data);
  return data;
}
