import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeFavoriteId, normalizeFavoriteIds } from './favoritesStorage';

export const CAR_FAVORITES_STORAGE_KEY = '@estateos_car_favorites';

export async function loadCarFavoriteIds(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(CAR_FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    return normalizeFavoriteIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function saveCarFavoriteIds(ids: number[]): Promise<void> {
  await AsyncStorage.setItem(CAR_FAVORITES_STORAGE_KEY, JSON.stringify(normalizeFavoriteIds(ids)));
}

export async function toggleCarFavoriteId(
  carId: unknown,
  current: number[],
): Promise<{ ids: number[]; added: boolean }> {
  const id = normalizeFavoriteId(carId);
  if (id == null) return { ids: current, added: false };
  const set = new Set(normalizeFavoriteIds(current));
  const added = !set.has(id);
  if (added) set.add(id);
  else set.delete(id);
  const ids = Array.from(set);
  await saveCarFavoriteIds(ids);
  return { ids, added };
}

export function isCarFavoriteId(carId: unknown, favorites: number[]): boolean {
  const id = normalizeFavoriteId(carId);
  if (id == null) return false;
  return favorites.includes(id);
}
