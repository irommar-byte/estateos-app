const STORAGE_KEY = 'eos-spotlight-recent-v1';
const MAX_ITEMS = 8;

export type SpotlightRecentItem = {
  query: string;
  at: number;
};

export function readSpotlightRecent(): SpotlightRecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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

export function pushSpotlightRecent(query: string): SpotlightRecentItem[] {
  const trimmed = String(query || '').trim();
  if (!trimmed || typeof window === 'undefined') return readSpotlightRecent();
  const next = [{ query: trimmed, at: Date.now() }, ...readSpotlightRecent().filter((item) => item.query !== trimmed)].slice(
    0,
    MAX_ITEMS,
  );
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}

export function clearSpotlightRecent(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
