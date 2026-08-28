import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@estateos_spotlight_recent_v1';
const MAX_ITEMS = 8;

export type SpotlightRecentItem = {
  query: string;
  at: number;
};

export async function readSpotlightRecent(): Promise<SpotlightRecentItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        query: String(item?.query || '').trim(),
        at: Number(item?.at || 0),
      }))
      .filter((item) => item.query.length >= 1)
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export async function pushSpotlightRecent(query: string): Promise<SpotlightRecentItem[]> {
  const trimmed = String(query || '').trim();
  if (!trimmed) return readSpotlightRecent();
  const current = await readSpotlightRecent();
  const next = [{ query: trimmed, at: Date.now() }, ...current.filter((item) => item.query !== trimmed)].slice(
    0,
    MAX_ITEMS,
  );
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
