import AsyncStorage from '@react-native-async-storage/async-storage';

function storageKey(userId: number) {
  return `@eos_crm_person_order_${userId}`;
}

export async function loadCrmPersonOrder(userId: number): Promise<string[]> {
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function saveCrmPersonOrder(userId: number, keys: string[]): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(keys));
  } catch {
    /* ignore */
  }
}
