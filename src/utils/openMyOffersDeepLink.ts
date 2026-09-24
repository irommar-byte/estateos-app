/** One-shot deep link: OfferDetail → Profile → Moje ogłoszenia (wznawianie). */

export type OpenMyOffersRequest = {
  tab?: 'ACTIVE' | 'PENDING' | 'ARCHIVED';
  offerId?: number;
};

let pending: OpenMyOffersRequest | null = null;

export function requestOpenMyOffers(req: OpenMyOffersRequest = {}) {
  pending = { ...req };
}

export function consumeOpenMyOffersRequest(): OpenMyOffersRequest | null {
  const next = pending;
  pending = null;
  return next;
}
