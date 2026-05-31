import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProfilePromoCardRecord } from '../contracts/profilePromoContract';

const localKey = (userId: string | number) => `@estateos_profile_promos_${userId}`;
const pendingRegisterKey = '@estateos_pending_welcome_email';

export function welcomeCouponIdForUser(userId: string | number): string {
  return `welcome_${String(userId)}`;
}

export function isWelcomeCouponRecord(card: {
  id?: string;
  kind?: string;
  templateId?: string;
}): boolean {
  const id = String(card.id || '');
  return (
    card.kind === 'welcome_coupon' ||
    card.templateId === 'welcome_free_listing' ||
    id.startsWith('welcome_')
  );
}

function buildWelcomeCouponRecord(userId: string | number): ProfilePromoCardRecord {
  const id = welcomeCouponIdForUser(userId);
  const accent = '#0A84FF';
  return {
    id,
    kind: 'welcome_coupon',
    templateId: 'welcome_free_listing',
    title: 'Kupon powitalny',
    subtitle: 'Jedna darmowa publikacja pierwszej oferty',
    meta: 'Wykorzystaj przy pierwszym publicznym wystawieniu ogłoszenia.',
    pillLabel: 'Powitalny',
    pillColor: accent,
    pillBg: 'rgba(10,132,255,0.14)',
    pillBorder: 'rgba(10,132,255,0.38)',
    iconName: 'sparkles',
    iconBg: accent,
    borderColor: 'rgba(10,132,255,0.36)',
    grantsFreeListing: true,
    couponUsed: false,
    purpose: 'publication',
    visualTheme: 'default',
    createdAt: new Date().toISOString(),
  };
}

async function loadLocalPromoRows(userId: string | number): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(localKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveWelcomeCouponLocal(userId: string | number): Promise<ProfilePromoCardRecord> {
  const card = buildWelcomeCouponRecord(userId);
  const rows = await loadLocalPromoRows(userId);
  const idx = rows.findIndex((row) => isWelcomeCouponRecord(row));
  const next =
    idx >= 0
      ? rows.map((row, i) => (i === idx ? { ...row, ...card, couponUsed: row.couponUsed === true } : row))
      : [...rows, card];
  await AsyncStorage.setItem(localKey(userId), JSON.stringify(next));
  return idx >= 0 && rows[idx]?.couponUsed === true ? { ...card, couponUsed: true } : card;
}

/** Po rejestracji — pierwsze logowanie ma nadać kupon powitalny. */
export async function markPendingWelcomeCouponForEmail(email: string): Promise<void> {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return;
  await AsyncStorage.setItem(pendingRegisterKey, normalized);
}

async function consumePendingWelcomeGrant(email: string): Promise<boolean> {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;
  try {
    const pending = String((await AsyncStorage.getItem(pendingRegisterKey)) || '')
      .trim()
      .toLowerCase();
    if (!pending || pending !== normalized) return false;
    await AsyncStorage.removeItem(pendingRegisterKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Nadaje kupon powitalny (lokalnie), jeśli użytkownik go jeszcze nie ma.
 * Nie nadaje, gdy konto już wykorzystało dawną „pierwszą darmową publikację” bez kuponu.
 */
export async function ensureWelcomeCouponForUser(
  userId: string | number,
  opts?: {
    email?: string | null;
    firstFreePublicationUsed?: boolean | null;
  },
): Promise<ProfilePromoCardRecord | null> {
  const rows = await loadLocalPromoRows(userId);
  const existing = rows.find((row) => isWelcomeCouponRecord(row));
  if (existing?.couponUsed === true) return null;
  if (existing) return existing as ProfilePromoCardRecord;

  if (opts?.firstFreePublicationUsed === true) return null;

  const pendingRegister =
    opts?.email != null ? await consumePendingWelcomeGrant(opts.email) : false;
  if (pendingRegister) return saveWelcomeCouponLocal(userId);

  if (opts?.firstFreePublicationUsed === false) {
    return saveWelcomeCouponLocal(userId);
  }

  return null;
}
