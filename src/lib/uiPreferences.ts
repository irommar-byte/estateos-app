import { prisma } from '@/lib/prisma';

/** Klucze ustawień interfejsu, które użytkownik może zapisać. */
export const UI_PREFERENCE_KEYS = ['crm_rail'] as const;
export type UiPreferenceKey = (typeof UI_PREFERENCE_KEYS)[number];

export function isUiPreferenceKey(key: unknown): key is UiPreferenceKey {
  return UI_PREFERENCE_KEYS.includes(String(key) as UiPreferenceKey);
}

export async function getUiPreference(userId: number, key: UiPreferenceKey): Promise<unknown | null> {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      'SELECT value FROM UserUiPreference WHERE userId = ? AND `key` = ? LIMIT 1',
      userId,
      key,
    )) as Array<{ value: unknown }>;
    const raw = rows[0]?.value;
    return typeof raw === 'string' ? JSON.parse(raw) : (raw ?? null);
  } catch {
    // Tabela jeszcze nie istnieje (przed migracją) — interfejs użyje ustawień domyślnych.
    return null;
  }
}

export async function setUiPreference(userId: number, key: UiPreferenceKey, value: unknown): Promise<void> {
  const json = JSON.stringify(value ?? null);
  if (json.length > 16_000) throw new Error('Za dużo danych do zapisania.');
  await prisma.$executeRawUnsafe(
    'INSERT INTO UserUiPreference (userId, `key`, value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
    userId,
    key,
    json,
  );
}
