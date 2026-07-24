import { API_URL } from '../config/network';
import { Platform } from 'react-native';

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

type ShareMessageParams = {
  title: string;
  priceLine: string;
  locationLine?: string | null;
  url: string;
};

/**
 * Czysta treść share (bez spamowego footera i bez podwójnego URL).
 * Na iOS URL idzie w polu `url` (preview), więc NIE powtarzamy go w `message`
 * — Facebook / Messenger inaczej sklejają tekst z linkiem.
 */
export function buildProfessionalShareContent(params: ShareMessageParams): {
  message: string;
  url: string;
} {
  const title = String(params.title || '').trim() || 'EstateOS™';
  const price = String(params.priceLine || '').trim();
  const location = String(params.locationLine || '').trim();
  const url = params.url;

  const headline = price ? `${title} — ${price}` : title;
  const lines = [headline];
  if (location) lines.push(location);

  if (Platform.OS === 'ios') {
    // iOS: osobne `url` → bogata karta; message bez linku.
    return { message: lines.join('\n'), url };
  }

  // Android / inne: jeden link na końcu wiadomości.
  lines.push('', url);
  return { message: lines.join('\n'), url };
}

export function buildOfferShareMessage(params: {
  title: string;
  priceLine: string;
  offerId: number | string;
  locationLine?: string | null;
}): { message: string; url: string } {
  return buildProfessionalShareContent({
    title: params.title,
    priceLine: params.priceLine,
    locationLine: params.locationLine,
    url: buildOfferLandingPageUrl(params.offerId),
  });
}

export function buildCarShareMessage(params: {
  title: string;
  priceLine: string;
  carId: number | string;
  locationLine?: string | null;
}): { message: string; url: string } {
  return buildProfessionalShareContent({
    title: params.title,
    priceLine: params.priceLine,
    locationLine: params.locationLine,
    url: buildCarLandingPageUrl(params.carId),
  });
}
