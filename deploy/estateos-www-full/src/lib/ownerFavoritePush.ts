import { sendNotification } from '@/lib/core/notification.core';

function offerDeepLink(offerId: number) {
  return `estateos://oferta/${offerId}`;
}

/** Pierwsze serduszko na ofercie — inbox WWW + push do właściciela. */
export function notifyOwnerFirstFavorite(input: {
  ownerUserId: number;
  offerId: number;
  offerTitle?: string | null;
}): void {
  if (!Number.isFinite(input.ownerUserId) || input.ownerUserId <= 0) return;
  const label = input.offerTitle?.trim()
    ? `„${input.offerTitle.trim().slice(0, 72)}”`
    : `oferta #${input.offerId}`;

  void sendNotification({
    userId: input.ownerUserId,
    type: 'NEW_OFFER',
    title: 'Ktoś dodał Twoją ofertę do ulubionych',
    body: `${label} trafiła do ulubionych. Jeśli zmienisz cenę, osoby zainteresowane dostaną powiadomienie natychmiast.`,
    data: {
      type: 'OFFER_FIRST_FAVORITE',
      notificationType: 'offer_first_favorite',
      offerId: input.offerId,
      screen: 'OfferDetail',
      deeplink: offerDeepLink(input.offerId),
    },
    idempotencyKey: `offer-first-favorite:${input.offerId}`,
  }).catch((err) => console.error('[FAVORITE_PUSH] owner first favorite failed', err));
}
