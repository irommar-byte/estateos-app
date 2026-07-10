const CAR_FAVORITES_STORAGE_KEY = "estateos_car_favorites";

function normalizeFavoriteId(value: unknown): number | null {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
}

function normalizeFavoriteIds(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(normalizeFavoriteId).filter((id): id is number => id != null))];
}

export function loadCarFavoriteIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CAR_FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    return normalizeFavoriteIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveCarFavoriteIds(ids: number[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CAR_FAVORITES_STORAGE_KEY, JSON.stringify(normalizeFavoriteIds(ids)));
}

export function isCarFavoriteId(carId: unknown, favorites: number[]): boolean {
  const id = normalizeFavoriteId(carId);
  if (id == null) return false;
  return favorites.includes(id);
}

export function toggleCarFavoriteId(
  carId: unknown,
  current: number[],
): { ids: number[]; added: boolean } {
  const id = normalizeFavoriteId(carId);
  if (id == null) return { ids: current, added: false };
  const set = new Set(normalizeFavoriteIds(current));
  const added = !set.has(id);
  if (added) set.add(id);
  else set.delete(id);
  const ids = Array.from(set);
  saveCarFavoriteIds(ids);
  return { ids, added };
}
