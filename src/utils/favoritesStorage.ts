import AsyncStorage from '@react-native-async-storage/async-storage';

export const FAVORITES_STORAGE_KEY = '@estateos_favorites';

export type FavoriteSyncOptions = {
  apiBaseUrl?: string;
  accessToken?: string | null;
};

export function normalizeFavoriteId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function normalizeFavoriteIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const item of raw) {
    const id = normalizeFavoriteId(item);
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function fetchFavoriteIdsFromServer(
  apiBaseUrl: string,
  accessToken: string,
): Promise<number[] | null> {
  const base = apiBaseUrl.replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/api/favorites`, {
      headers: authHeaders(accessToken),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return normalizeFavoriteIds(data?.offerIds);
  } catch {
    return null;
  }
}

async function syncFavoriteToServer(
  offerId: number,
  added: boolean,
  options?: FavoriteSyncOptions,
): Promise<void> {
  const base = String(options?.apiBaseUrl || '').replace(/\/+$/, '');
  const token = String(options?.accessToken || '').trim();
  if (!base || !token) return;

  const method = added ? 'POST' : 'DELETE';
  try {
    await fetch(`${base}/api/offers/${offerId}/favorite`, {
      method,
      headers: authHeaders(token),
    });
  } catch {
    // offline — local cache remains source until next load
  }
}

export async function loadFavoriteIds(options?: FavoriteSyncOptions): Promise<number[]> {
  const token = String(options?.accessToken || '').trim();
  const base = String(options?.apiBaseUrl || '').replace(/\/+$/, '');

  if (base && token) {
    const remote = await fetchFavoriteIdsFromServer(base, token);
    if (remote) {
      await saveFavoriteIds(remote);
      return remote;
    }
  }

  try {
    const raw = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    return normalizeFavoriteIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function saveFavoriteIds(ids: number[]): Promise<void> {
  const normalized = normalizeFavoriteIds(ids);
  await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(normalized));
}

export async function toggleFavoriteId(
  offerId: unknown,
  current: number[],
  options?: FavoriteSyncOptions,
): Promise<{ ids: number[]; added: boolean }> {
  const id = normalizeFavoriteId(offerId);
  if (id == null) return { ids: current, added: false };
  const set = new Set(normalizeFavoriteIds(current));
  const added = !set.has(id);
  if (added) set.add(id);
  else set.delete(id);
  const ids = Array.from(set);
  await saveFavoriteIds(ids);
  void syncFavoriteToServer(id, added, options);
  return { ids, added };
}

export function isFavoriteId(offerId: unknown, favorites: number[]): boolean {
  const id = normalizeFavoriteId(offerId);
  if (id == null) return false;
  return favorites.includes(id);
}
