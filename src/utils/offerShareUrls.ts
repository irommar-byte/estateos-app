import { API_URL } from '../config/network';
import { Platform, Share } from 'react-native';

/** Publiczny origin serwisu (bez /api). */
export const SITE_ORIGIN = API_URL.replace(/\/+$/, '').replace(/\/api\/?.*$/i, '') || 'https://estateos.pl';

/**
 * Wizytówka nieruchomości — `/o/:id` (SSR Open Graph pod Facebook / iMessage).
 */
export function buildOfferLandingPageUrl(offerId: number | string): string {
  const id = encodeURIComponent(String(offerId).trim());
  return `${SITE_ORIGIN}/o/${id}`;
}

/** Zgodny z wizytówką Next: `estateos://o/{id}`. */
export function buildOfferAppDeepLink(offerId: number | string): string {
  const id = String(offerId).trim();
  return `estateos://o/${id}`;
}

/**
 * Publiczna karta auta — `/cars/:id` (OG meta na stronie szczegółu).
 */
export function buildCarLandingPageUrl(carId: number | string): string {
  const id = encodeURIComponent(String(carId).trim());
  return `${SITE_ORIGIN}/cars/${id}`;
}

export function buildCarAppDeepLink(carId: number | string): string {
  const id = String(carId).trim();
  return `estateos://cars/${id}`;
}

/**
 * Profesjonalny share pod Facebook / grupy:
 * wysyłamy **sam link** (bez własnego tekstu).
 * Dzięki temu FB scrapuje Open Graph i pokazuje kartę ze zdjęciem,
 * a nie goły post tekstowy z URL w treści.
 */
export async function shareListingLink(params: {
  url: string;
  /** Tytuł activity sheet (iOS) / chooser (Android) — nie trafia do treści posta FB. */
  sheetTitle?: string;
}): Promise<void> {
  const url = String(params.url || '').trim();
  if (!url) return;
  const sheetTitle = params.sheetTitle || 'EstateOS™';

  if (Platform.OS === 'ios') {
    await Share.share({ url, title: sheetTitle });
    return;
  }

  // Android: sam URL jako message — FB traktuje to jak udostępnienie linku.
  await Share.share({ message: url, title: sheetTitle });
}

export function buildOfferShareMessage(params: {
  title: string;
  priceLine: string;
  offerId: number | string;
  locationLine?: string | null;
}): { message: string; url: string } {
  const url = buildOfferLandingPageUrl(params.offerId);
  // Zachowane dla kompatybilności (kalendarz / testy) — share UI używa shareListingLink.
  const title = String(params.title || '').trim() || 'EstateOS™';
  const price = String(params.priceLine || '').trim();
  const location = String(params.locationLine || '').trim();
  const headline = price ? `${title} — ${price}` : title;
  const lines = [headline];
  if (location) lines.push(location);
  lines.push('', url);
  return { message: lines.join('\n'), url };
}

export function buildCarShareMessage(params: {
  title: string;
  priceLine: string;
  carId: number | string;
  locationLine?: string | null;
}): { message: string; url: string } {
  const url = buildCarLandingPageUrl(params.carId);
  const title = String(params.title || '').trim() || 'EstateOS™Car';
  const price = String(params.priceLine || '').trim();
  const location = String(params.locationLine || '').trim();
  const headline = price ? `${title} — ${price}` : title;
  const lines = [headline];
  if (location) lines.push(location);
  lines.push('', url);
  return { message: lines.join('\n'), url };
}
