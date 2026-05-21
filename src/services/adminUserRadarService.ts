import { API_URL } from '../config/network';

/** Wyciąga obiekt preferencji radaru z różnych kształtów odpowiedzi API / Prisma. */
export function coalesceRadarPreferenceFromPayload(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;

  const direct =
    p.radarPreference ||
    p.radar_preference ||
    p.RadarPreference ||
    p.preference ||
    p.preferences;
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    return direct as Record<string, unknown>;
  }

  const list = p.radarPreferences || p.radar_preferences || p.RadarPreferences;
  if (Array.isArray(list) && list[0] && typeof list[0] === 'object') {
    return list[0] as Record<string, unknown>;
  }

  if (
    p.city != null ||
    p.transactionType != null ||
    p.transaction_type != null ||
    p.pushNotifications != null ||
    p.push_notifications != null ||
    p.minMatchThreshold != null
  ) {
    return p;
  }

  const nested = p.radar as Record<string, unknown> | undefined;
  if (nested && typeof nested === 'object' && (nested.preference || nested.preferences)) {
    return coalesceRadarPreferenceFromPayload(nested);
  }

  return null;
}

function extractFromJson(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  return (
    coalesceRadarPreferenceFromPayload(d.user) ||
    coalesceRadarPreferenceFromPayload(d.buyerProfile) ||
    coalesceRadarPreferenceFromPayload(d.buyer_profile) ||
    coalesceRadarPreferenceFromPayload(d.radarPreference) ||
    coalesceRadarPreferenceFromPayload(d.preference) ||
    coalesceRadarPreferenceFromPayload(d) ||
    null
  );
}

/**
 * Dociąga pełne preferencje radaru użytkownika (admin).
 * POST /api/radar/preferences zapisuje dane — GET admin/users/:id często ich nie zwraca.
 */
export async function fetchAdminUserRadarPreference(
  userId: number | string,
  token: string,
): Promise<Record<string, unknown> | null> {
  const id = encodeURIComponent(String(userId));
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Cache-Control': 'no-cache',
  };

  // Kolejność: dedykowane admin GET (backend wdrożony), potem ogólny GET z userId.
  const paths = [
    `/api/radar/preferences?userId=${id}`,
    `/api/mobile/v1/admin/users/${id}/radar-preferences`,
    `/api/mobile/v1/admin/users/${id}/radar`,
    `/api/mobile/v1/admin/radar/preferences?userId=${id}`,
  ];

  for (const path of paths) {
    try {
      const res = await fetch(`${API_URL}${path}`, { headers, cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json().catch(() => null);
      const pref = extractFromJson(data);
      if (pref && hasMeaningfulRadarFields(pref)) return pref;
      if (pref && (pref.pushNotifications === true || pref.push_notifications === true)) return pref;
    } catch {
      // następny endpoint
    }
  }
  return null;
}

/** Czy obiekt preferencji ma pola do wyświetlenia w karcie admina (poza samym push). */
export function hasMeaningfulRadarFields(pref: Record<string, unknown> | null | undefined): boolean {
  if (!pref || typeof pref !== 'object') return false;
  const city = String(pref.city || pref.locality || '').trim();
  const districts = Array.isArray(pref.selectedDistricts || pref.selected_districts || pref.districts)
    ? ((pref.selectedDistricts || pref.selected_districts || pref.districts) as unknown[])
    : [];
  const minYear = Number(pref.minYear ?? pref.min_year);
  const maxPrice = Number(pref.maxPrice ?? pref.max_price);
  const minArea = Number(pref.minArea ?? pref.min_area);
  return (
    !!city ||
    districts.length > 0 ||
    (Number.isFinite(minYear) && minYear > 1900) ||
    (Number.isFinite(maxPrice) && maxPrice > 0) ||
    (Number.isFinite(minArea) && minArea > 0)
  );
}

/** Scala preferencje z detail + osobnego fetchu (pełniejsze wygrywają). */
export function mergeRadarPreferenceForAdminUser(
  user: Record<string, unknown>,
  fetched: Record<string, unknown> | null,
): Record<string, unknown> {
  const fromUser = coalesceRadarPreferenceFromPayload(user);
  if (!fetched) return fromUser || {};
  if (!fromUser) return fetched;
  const merged = { ...fromUser, ...fetched };
  if (!hasMeaningfulRadarFields(fetched) && hasMeaningfulRadarFields(fromUser)) {
    return { ...fetched, ...fromUser };
  }
  return merged;
}
