/**
 * Wspólna logika katalogu ofert (mapa + galeria) — testowalna przed buildem Android.
 */

const CLOSED_OFFER_STATUSES = new Set([
  'ARCHIVED',
  'CLOSED',
  'OFF_MARKET',
  'SOLD',
  'FINALIZED',
  'COMPLETED',
  'DONE',
  'EXPIRED',
  'REJECTED',
  'INACTIVE',
  'CANCELLED',
  'CANCELED',
]);

function isOfferClosedForCatalog(o: any): boolean {
  if (!o || typeof o !== 'object') return false;
  if (o.isArchived === true || o.archived === true) return true;
  if (o.isSold === true || o.sold === true) return true;
  if (o.isExpired === true || o.expired === true) return true;
  const status = String(o.status ?? o.state ?? o.lifecycleStatus ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  return CLOSED_OFFER_STATUSES.has(status);
}

export function parseOfferList(data: unknown): any[] | null {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  if (Array.isArray(row.offers)) return row.offers;
  if (Array.isArray(row.data)) return row.data;
  if (Array.isArray(row.items)) return row.items;
  return null;
}

export function mapRawOfferForRadar(o: any): { id: number; lat: number; lng: number } | null {
  if (!Number.isFinite(Number(o?.lat)) || !Number.isFinite(Number(o?.lng))) return null;
  const id = Number(o?.id);
  if (!Number.isFinite(id)) return null;
  return { id, lat: Number(o.lat), lng: Number(o.lng) };
}

export function buildRadarPinList(rawList: any[]): { id: number; lat: number; lng: number }[] {
  return rawList
    .filter((o) => !isOfferClosedForCatalog(o))
    .map((o) => mapRawOfferForRadar(o))
    .filter((m): m is { id: number; lat: number; lng: number } => m !== null);
}

export function normalizeLoginErrorMessage(raw: string): string {
  const lower = raw.toLowerCase();
  if (/network request failed|failed to fetch|timeout|timed out|przekroczono limit czasu|abort/i.test(lower)) {
    return 'Brak połączenia z serwerem EstateOS™. Sprawdź internet i spróbuj ponownie.';
  }
  if (/invalid credentials|wrong password|incorrect password|niepoprawne hasło|złe hasło|wrong email or password|nieprawidłowe dane|nieprawidłowy e-mail|nieprawidłowy login/i.test(lower)) {
    return 'Nieprawidłowy e-mail lub hasło. Sprawdź dane i spróbuj ponownie.';
  }
  return raw || 'Nie udało się zalogować. Sprawdź dane i spróbuj ponownie.';
}

export const CATALOG_ENDPOINTS = [
  'https://estateos.pl/api/mobile/v1/offers?catalog=1',
  'https://estateos.pl/api/mobile/v1/offers',
  'https://estateos.pl/api/offers',
] as const;

export const LOGIN_URL = 'https://estateos.pl/api/mobile/v1/auth/login';
