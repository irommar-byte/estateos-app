import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/network';
import type { AdminPromoCardPayload, ProfilePromoCardRecord } from '../contracts/profilePromoContract';

const localKey = (userId: string | number) => `@estateos_profile_promos_${userId}`;

function normalizePromoRow(raw: any): ProfilePromoCardRecord | null {
  const id = String(raw?.id ?? '').trim();
  if (!id) return null;
  const accent = String(raw?.accentColor || raw?.accent || '#AF52DE').trim();
  return {
    id,
    kind: 'admin_promo',
    title: String(raw?.title || 'Oferta specjalna'),
    subtitle: String(raw?.subtitle || ''),
    meta: String(raw?.meta || raw?.description || ''),
    pillLabel: String(raw?.pillLabel || 'Specjalne'),
    pillColor: accent,
    pillBg: `${accent}24`,
    pillBorder: `${accent}55`,
    iconName: String(raw?.iconName || 'sparkles'),
    iconBg: accent,
    borderColor: `${accent}44`,
    peelable: true,
    peelHint: false,
    createdAt: raw?.createdAt ? String(raw.createdAt) : undefined,
  };
}

export async function fetchUserProfilePromoCards(
  token: string,
  userId: string | number,
): Promise<ProfilePromoCardRecord[]> {
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
      return { ok: true, card: card ?? undefined };
    }
  } catch {
    // fallback lokalny (dev / brak API)
  }

  try {
    const id = `local_${Date.now()}`;
    const card: ProfilePromoCardRecord = {
      id,
      kind: 'admin_promo',
      title: body.title,
      subtitle: body.subtitle,
      meta: body.meta,
      pillLabel: 'Od admina',
      pillColor: body.accentColor,
      pillBg: `${body.accentColor}24`,
      pillBorder: `${body.accentColor}55`,
      iconName: body.iconName,
      iconBg: body.accentColor,
      borderColor: `${body.accentColor}44`,
      peelable: true,
      createdAt: new Date().toISOString(),
    };
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
