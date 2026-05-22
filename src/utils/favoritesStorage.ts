import AsyncStorage from '@react-native-async-storage/async-storage';

export const FAVORITES_STORAGE_KEY = '@estateos_favorites';

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

export async function loadFavoriteIds(): Promise<number[]> {
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
): Promise<{ ids: number[]; added: boolean }> {
  const id = normalizeFavoriteId(offerId);
  if (id == null) return { ids: current, added: false };
  const set = new Set(normalizeFavoriteIds(current));
  const added = !set.has(id);
  if (added) set.add(id);
  else set.delete(id);
  const ids = Array.from(set);
  await saveFavoriteIds(ids);
  return { ids, added };
}

export function isFavoriteId(offerId: unknown, favorites: number[]): boolean {
  const id = normalizeFavoriteId(offerId);
  if (id == null) return false;
  return favorites.includes(id);
}
