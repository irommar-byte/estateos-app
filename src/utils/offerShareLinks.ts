import { API_URL } from '../config/network';

/** Publiczny origin serwisu (bez /api). */
export const SITE_ORIGIN = API_URL.replace(/\/+$/, '').replace(/\/api\/?.*$/i, '') || 'https://estateos.pl';

function titleHash(title?: string | null): string {
  const raw = String(title || '')
    .trim()
    .toLowerCase();
  if (!raw) return 'h0';
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(36)}`;
}

/** Price + title + last save — Facebook caches the pasted URL, so it must change after an edit. */
export function offerShareContentStamp(input: {
  pricePln?: number | null;
  price?: number | null;
  updatedAt?: Date | string | number | null;
  title?: string | null;
}): string {
  const price = Math.round(Number(input.pricePln ?? input.price ?? 0));
  const pricePart = Number.isFinite(price) && price > 0 ? `p${price}` : 'p0';
  const ms = input.updatedAt != null ? new Date(input.updatedAt).getTime() : 0;
  const timePart = Number.isFinite(ms) && ms > 0 ? `t${Math.floor(ms / 1000)}` : 't0';
  return `${pricePart}-${timePart}-${titleHash(input.title)}`;
}

/**
 * Wizytówka nieruchomości — `/o/:id` (SSR Open Graph pod Facebook / iMessage).
 * After a price/title save pass listing fields so the URL (and Facebook card) changes.
 */
export function buildOfferLandingPageUrl(
  offerId: number | string,
  content?: {
    pricePln?: number | null;
    price?: number | null;
    updatedAt?: Date | string | number | null;
    title?: string | null;
  },
): string {
  const id = encodeURIComponent(String(offerId).trim());
  const stamp = content ? offerShareContentStamp(content) : '';
  const qs = stamp ? `?og=${encodeURIComponent(stamp)}` : '';
  return `${SITE_ORIGIN}/o/${id}${qs}`;
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

export function buildOfferShareMessage(params: {
  title: string;
  priceLine: string;
  offerId: number | string;
  locationLine?: string | null;
}): { message: string; url: string } {
  const url = buildOfferLandingPageUrl(params.offerId);
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
