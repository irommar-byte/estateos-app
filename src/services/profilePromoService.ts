import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/network';
import type { AdminPromoCardPayload, ProfilePromoCardRecord } from '../contracts/profilePromoContract';
import { applyBirthdayYearPalette, getBirthdayYearPalette } from '../utils/birthdayCouponTheme';
import {
  ensureWelcomeCouponForUser,
  isWelcomeCouponRecord,
  welcomeCouponIdForUser,
} from './welcomeCouponService';

const localKey = (userId: string | number) => `@estateos_profile_promos_${userId}`;

function normalizePromoRow(raw: any): ProfilePromoCardRecord | null {
  const id = String(raw?.id ?? '').trim();
  if (!id) return null;
  const templateRaw = raw?.templateId ?? raw?.template_id;
  const templateId =
    templateRaw === 'birthday_free_listing'
      ? 'birthday_free_listing'
      : templateRaw === 'welcome_free_listing'
        ? 'welcome_free_listing'
        : undefined;
  const grantsFreeListing =
    raw?.grantsFreeListing === true ||
    raw?.grants_free_listing === true ||
    templateId === 'birthday_free_listing' ||
    templateId === 'welcome_free_listing';
  const accent = String(raw?.accentColor || raw?.accent || '#AF52DE').trim();
  const kindRaw = String(raw?.kind ?? '').trim();
  const kind =
    templateId === 'welcome_free_listing' || kindRaw === 'welcome_coupon'
      ? 'welcome_coupon'
      : templateId === 'birthday_free_listing' ||
          kindRaw === 'birthday_coupon' ||
          kindRaw === 'birthday'
        ? 'birthday_coupon'
        : 'admin_promo';
  return {
    id,
    kind,
    title: String(raw?.title || 'Oferta specjalna'),
    subtitle: String(raw?.subtitle || ''),
    meta: String(raw?.meta || raw?.description || ''),
    pillLabel: String(raw?.pillLabel || (templateId ? 'Urodziny' : 'Specjalne')),
    pillColor: accent,
    pillBg: `${accent}24`,
    pillBorder: `${accent}55`,
    iconName: String(raw?.iconName || 'sparkles'),
    iconBg: accent,
    borderColor: `${accent}44`,
    peelHint: false,
    templateId,
    grantsFreeListing: grantsFreeListing || undefined,
    couponUsed:
      raw?.couponUsed === true || raw?.coupon_used === true
        ? true
        : raw?.couponUsed === false || raw?.coupon_used === false
          ? false
          : undefined,
    purpose:
      raw?.purpose === 'publication' ||
      raw?.purpose === 'off_market_preview' ||
      raw?.purpose === 'generic'
        ? raw.purpose
        : grantsFreeListing
          ? 'publication'
          : undefined,
    createdAt: raw?.createdAt ? String(raw.createdAt) : undefined,
    birthdayYear:
      raw?.birthdayYear != null && Number.isFinite(Number(raw.birthdayYear))
        ? Math.floor(Number(raw.birthdayYear))
        : undefined,
  };
}

async function loadLocalProfilePromoCards(
  userId: string | number,
): Promise<ProfilePromoCardRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(localKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : [];
    return rows.map(normalizePromoRow).filter(Boolean) as ProfilePromoCardRecord[];
  } catch {
    return [];
  }
}

/** Lokalne kupony (np. urodzinowe z panelu admina) + API — API wygrywa przy tym samym id. */
function mergePromoCardRow(
  local: ProfilePromoCardRecord | undefined,
  remote: ProfilePromoCardRecord,
): ProfilePromoCardRecord {
  if (!local) return remote;
  const used = local.couponUsed === true || remote.couponUsed === true;
  return {
    ...local,
    ...remote,
    ...(used ? { couponUsed: true as const } : {}),
  };
}

export function mergeProfilePromoCards(
  remote: ProfilePromoCardRecord[],
  local: ProfilePromoCardRecord[],
): ProfilePromoCardRecord[] {
  const byId = new Map<string, ProfilePromoCardRecord>();
  for (const card of local) byId.set(card.id, card);
  for (const card of remote) {
    byId.set(card.id, mergePromoCardRow(byId.get(card.id), card));
  }
  return [...byId.values()].sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return tb - ta;
  });
}

async function fetchRemoteProfilePromoCards(
  token: string,
  userId: string | number,
): Promise<ProfilePromoCardRecord[] | null> {
  const paths = [
    `/api/mobile/v1/users/${encodeURIComponent(String(userId))}/promo-cards`,
    `/api/mobile/v1/me/promo-cards`,
  ];
  for (const path of paths) {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) continue;
      const rows = Array.isArray(data?.cards)
        ? data.cards
        : Array.isArray(data?.promos)
          ? data.promos
          : Array.isArray(data?.items)
            ? data.items
            : [];
      return rows.map(normalizePromoRow).filter(Boolean) as ProfilePromoCardRecord[];
    } catch {
      // następny endpoint
    }
  }
  return null;
}

export async function fetchUserProfilePromoCards(
  token: string,
  userId: string | number,
  opts?: {
    email?: string | null;
    firstFreePublicationUsed?: boolean | null;
  },
): Promise<ProfilePromoCardRecord[]> {
  await ensureWelcomeCouponForUser(userId, {
    email: opts?.email,
    firstFreePublicationUsed: opts?.firstFreePublicationUsed,
  });
  const local = await loadLocalProfilePromoCards(userId);
  const remote = await fetchRemoteProfilePromoCards(token, userId);
  const merged = remote != null ? mergeProfilePromoCards(remote, local) : local;
  return merged.filter(
    (card) => !isWelcomeCouponRecord(card) || card.id === welcomeCouponIdForUser(userId),
  );
}

export async function sendAdminProfilePromoCard(
  token: string,
  payload: AdminPromoCardPayload,
): Promise<{ ok: boolean; card?: ProfilePromoCardRecord; error?: string }> {
  const body = {
    title: payload.title,
    subtitle: payload.subtitle,
    meta: payload.meta || '',
    accentColor: payload.accentColor || '#AF52DE',
    iconName: payload.iconName || 'sparkles',
    expiresAt: payload.expiresAt ?? null,
    templateId: payload.templateId ?? null,
    grantsFreeListing: payload.grantsFreeListing === true,
    pillLabel: payload.pillLabel ?? null,
    purpose: payload.purpose ?? (payload.grantsFreeListing ? 'publication' : null),
  };

  try {
    const res = await fetch(
      `${API_URL}/api/mobile/v1/admin/users/${encodeURIComponent(String(payload.userId))}/promo-cards`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const card = normalizePromoRow(data?.card ?? data);
      void requestBonusCouponPushNotify(token, payload.userId, card ?? undefined, body);
      return { ok: true, card: card ?? undefined };
    }
  } catch {
    // fallback lokalny (dev / brak API)
  }

  try {
    const id = `local_${Date.now()}`;
    const year = new Date().getFullYear();
    const isBirthday = payload.templateId === 'birthday_free_listing';
    const palette = isBirthday ? getBirthdayYearPalette(year) : null;
    let card: ProfilePromoCardRecord = {
      id,
      kind: isBirthday ? 'birthday_coupon' : 'admin_promo',
      title: body.title,
      subtitle: body.subtitle,
      meta: body.meta,
      pillLabel: body.pillLabel || (isBirthday ? 'Urodziny' : 'Od admina'),
      pillColor: palette?.pillColor ?? body.accentColor,
      pillBg: palette?.pillBg ?? `${body.accentColor}24`,
      pillBorder: palette?.pillBorder ?? `${body.accentColor}55`,
      iconName: body.iconName,
      iconBg: palette?.iconBg ?? body.accentColor,
      borderColor: palette?.borderColor ?? `${body.accentColor}44`,
      templateId: payload.templateId,
      grantsFreeListing: body.grantsFreeListing || undefined,
      couponUsed: false,
      purpose: payload.purpose ?? (body.grantsFreeListing ? 'publication' : undefined),
      createdAt: new Date().toISOString(),
      birthdayYear: isBirthday ? year : undefined,
    };
    if (isBirthday) card = applyBirthdayYearPalette(card, year);
    const key = localKey(payload.userId);
    const prevRaw = await AsyncStorage.getItem(key);
    const prev = prevRaw ? JSON.parse(prevRaw) : [];
    const next = Array.isArray(prev) ? [...prev, card] : [card];
    await AsyncStorage.setItem(key, JSON.stringify(next));
    return { ok: true, card };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Nie udało się zapisać promocji.' };
  }
}

/** Prośba do backendu o push Expo dla odbiorcy (gdy API promo-cards jest wdrożone). */
async function requestBonusCouponPushNotify(
  adminToken: string,
  userId: string | number,
  card: ProfilePromoCardRecord | undefined,
  body: Record<string, unknown>,
): Promise<void> {
  if (!card?.id) return;
  try {
    await fetch(
      `${API_URL}/api/mobile/v1/admin/users/${encodeURIComponent(String(userId))}/promo-cards/notify`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardId: card.id,
          title: body.title,
          subtitle: body.subtitle,
          templateId: body.templateId,
          kind: card.kind,
        }),
      },
    );
  } catch {
    // backend może nie mieć jeszcze endpointu — mobile i tak wykryje kupon przy wejściu w app
  }
}

export async function markProfilePromoCouponUsed(
  userId: string | number,
  cardId: string,
  token?: string | null,
): Promise<void> {
  if (token) {
    const paths = [
      `/api/mobile/v1/me/promo-cards/${encodeURIComponent(String(cardId))}`,
      `/api/mobile/v1/users/${encodeURIComponent(String(userId))}/promo-cards/${encodeURIComponent(String(cardId))}`,
    ];
    for (const path of paths) {
      try {
        const res = await fetch(`${API_URL}${path}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ couponUsed: true }),
        });
        if (res.ok) break;
      } catch {
        // następna ścieżka / brak endpointu
      }
    }
  }

  const key = localKey(userId);
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    const rows = Array.isArray(parsed) ? parsed : [];
    const hasId = rows.some((row: any) => String(row?.id) === String(cardId));
    const next = hasId
      ? rows.map((row: any) =>
          String(row?.id) === String(cardId) ? { ...row, couponUsed: true } : row,
        )
      : [...rows, { id: cardId, couponUsed: true }];
    await AsyncStorage.setItem(key, JSON.stringify(next));
  } catch {
    // noop
  }
}
