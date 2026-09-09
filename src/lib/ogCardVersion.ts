/** Bump when layout/copy of OG card changes — busts FB + disk cache.
 *  Facebook ignores query-string cache-busters on og:image — keep version in the PATH. */
export const OG_CARD_VERSION = 'v8';

const STAMP_SAFE = /[^a-zA-Z0-9-]/g;

export function sanitizeOgStamp(raw: string | null | undefined): string {
  return String(raw || '')
    .replace(STAMP_SAFE, '')
    .slice(0, 48);
}

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

/** Price + title + last save — Facebook caches the pasted URL and og:image by path. */
export function offerOgContentStamp(input: {
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

export function offerOgImagePath(offerId: number, stamp?: string | null): string {
  const safe = sanitizeOgStamp(stamp);
  const file = safe ? `${OG_CARD_VERSION}-${safe}` : OG_CARD_VERSION;
  return `/api/og/offer/${offerId}/${file}.jpg`;
}

export function carOgImagePath(carId: number, stamp?: string | null): string {
  const safe = sanitizeOgStamp(stamp);
  const file = safe ? `${OG_CARD_VERSION}-${safe}` : OG_CARD_VERSION;
  return `/api/og/car/${carId}/${file}.jpg`;
}
