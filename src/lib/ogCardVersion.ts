/** Bump when layout/copy of OG card changes — busts FB + disk cache.
 *  Facebook ignores query-string cache-busters on og:image — keep version in the PATH. */
export const OG_CARD_VERSION = 'v8';

export function offerOgImagePath(offerId: number): string {
  return `/api/og/offer/${offerId}/${OG_CARD_VERSION}.jpg`;
}

export function carOgImagePath(carId: number): string {
  return `/api/og/car/${carId}/${OG_CARD_VERSION}.jpg`;
}
