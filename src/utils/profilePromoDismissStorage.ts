import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (userId: string | number) => `@estateos_dismissed_profile_promos_${userId}`;

export async function loadDismissedProfilePromoIds(
  userId: string | number,
): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((id) => String(id)).filter(Boolean));
  } catch {
    return new Set();
  }
}

export async function dismissProfilePromoCardForever(
  userId: string | number,
  cardId: string,
): Promise<void> {
  const id = String(cardId).trim();
  if (!id) return;
  const prev = await loadDismissedProfilePromoIds(userId);
  prev.add(id);
  await AsyncStorage.setItem(key(userId), JSON.stringify([...prev]));
}
