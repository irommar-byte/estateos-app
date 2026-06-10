import type { AppLocale } from '../i18n/types';

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatLiveDistanceKm(
  userLat: number | null | undefined,
  userLng: number | null | undefined,
  offerLat: number | null | undefined,
  offerLng: number | null | undefined,
  locale: AppLocale
): string | null {
  const lat = Number(offerLat);
  const lng = Number(offerLng);
  const uLat = Number(userLat);
  const uLng = Number(userLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(uLat) || !Number.isFinite(uLng)) {
    return null;
  }
  const km = haversineKm(uLat, uLng, lat, lng);
  const display =
    km < 1 ? Math.max(0.1, Math.round(km * 10) / 10) : km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  const tag = locale === 'pl' ? 'pl-PL' : locale === 'ru' ? 'ru-RU' : 'en-GB';
  return `${display.toLocaleString(tag, { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
}
