import { sendNotification } from '@/lib/core/notification.core';

function offerDeepLink(offerId: number) {
  return `estateos://oferta/${offerId}`;
}

export function notifyOwnerLegalVerificationResult(input: {
  ownerUserId: number;
  offerId: number;
  approved: boolean;
  offerTitle?: string | null;
  rejectionText?: string | null;
  requestId?: number | null;
}): void {
  const label = input.offerTitle?.trim()
    ? `„${input.offerTitle.trim().slice(0, 72)}”`
    : `oferta #${input.offerId}`;
  const title = input.approved
    ? 'Tarcza bezpieczeństwa — KW zweryfikowana'
    : 'Weryfikacja KW odrzucona';
  const body = input.approved
    ? `${label} ma zieloną tarczę. Numer KW jest zablokowany.`
    : `${label}: ${input.rejectionText?.trim() || 'Popraw dane KW i wyślij ponownie.'}`;

  void sendNotification({
    userId: input.ownerUserId,
    type: 'NEW_OFFER',
    title,
    body,
    data: {
      type: input.approved ? 'LEGAL_VERIFIED' : 'LEGAL_REJECTED',
      notificationType: 'LEGAL_VERIFICATION',
      offerId: input.offerId,
      screen: 'OfferDetail',
      deeplink: offerDeepLink(input.offerId),
    },
    idempotencyKey: `legal-result:${input.offerId}:${input.requestId || 'x'}:${input.approved ? 'ok' : 'no'}`,
  }).catch((err) => console.error('[LEGAL_PUSH] owner result failed', err));
}

export function notifyOwnerOfferModeration(input: {
  ownerUserId: number;
  offerId: number;
  approved: boolean;
  offerTitle?: string | null;
}): void {
  const label = input.offerTitle?.trim()
    ? `„${input.offerTitle.trim().slice(0, 72)}”`
    : `oferta #${input.offerId}`;
  const title = input.approved ? 'Oferta zaakceptowana' : 'Oferta nie została opublikowana';
  const body = input.approved
    ? `${label} jest już na rynku.`
    : `${label} wróciła do Ciebie — sprawdź status w profilu.`;

  void sendNotification({
    userId: input.ownerUserId,
    type: 'NEW_OFFER',
    title,
    body,
    data: {
      type: input.approved ? 'OFFER_APPROVED' : 'OFFER_REJECTED',
      notificationType: 'OFFER_MODERATION',
      offerId: input.offerId,
      screen: 'OfferDetail',
      deeplink: offerDeepLink(input.offerId),
    },
    idempotencyKey: `offer-moderation:${input.offerId}:${input.approved ? 'active' : 'back'}`,
  }).catch((err) => console.error('[OFFER_MOD_PUSH] failed', err));
}

export function notifyOpenHouseReservation(input: {
  hostUserId: number;
  guestUserId: number;
  offerId: number;
  eventId: number;
  startsAt: Date;
  offerTitle?: string | null;
}): void {
  const when = input.startsAt.toLocaleString('pl-PL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const label = input.offerTitle?.trim()
    ? `„${input.offerTitle.trim().slice(0, 56)}”`
    : `oferta #${input.offerId}`;

  const payload = (userId: number, isHost: boolean) =>
    sendNotification({
      userId,
      type: 'CRM_EVENT',
      title: isHost ? 'Nowa rezerwacja dnia otwartego' : 'Rezerwacja potwierdzona',
      body: isHost
        ? `${label} · ${when}`
        : `Dzień otwarty ${label} · ${when}`,
      data: {
        type: isHost ? 'OPEN_HOUSE_RESERVED_HOST' : 'OPEN_HOUSE_RESERVED',
        notificationType: 'OPEN_HOUSE',
        offerId: input.offerId,
        eventId: input.eventId,
        screen: 'OpenHouseEvent',
        deeplink: offerDeepLink(input.offerId),
      },
      idempotencyKey: `oh-reserve:${input.eventId}:${input.guestUserId}:${isHost ? 'h' : 'g'}`,
    });

  void payload(input.guestUserId, false).catch((err) => console.error('[OH_PUSH] guest failed', err));
  if (input.hostUserId !== input.guestUserId) {
    void payload(input.hostUserId, true).catch((err) => console.error('[OH_PUSH] host failed', err));
  }
}

export function notifyOpenHouseCancelled(input: {
  hostUserId: number;
  guestUserId: number;
  offerId: number;
  eventId: number;
  startsAt?: Date | null;
  offerTitle?: string | null;
}): void {
  const when = input.startsAt
    ? input.startsAt.toLocaleString('pl-PL', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  const label = input.offerTitle?.trim()
    ? `„${input.offerTitle.trim().slice(0, 56)}”`
    : `oferta #${input.offerId}`;

  const payload = (userId: number, isHost: boolean) =>
    sendNotification({
      userId,
      type: 'CRM_EVENT',
      title: isHost ? 'Anulowano rezerwację dnia otwartego' : 'Rezerwacja odwołana',
      body: [label, when].filter(Boolean).join(' · '),
      data: {
        type: isHost ? 'OPEN_HOUSE_CANCELLED_HOST' : 'OPEN_HOUSE_CANCELLED',
        notificationType: 'OPEN_HOUSE',
        offerId: input.offerId,
        eventId: input.eventId,
        screen: 'OpenHouseEvent',
        deeplink: offerDeepLink(input.offerId),
      },
      idempotencyKey: `oh-cancel:${input.eventId}:${input.guestUserId}:${isHost ? 'h' : 'g'}:${Date.now()}`,
    });

  void payload(input.guestUserId, false).catch((err) => console.error('[OH_PUSH] cancel guest failed', err));
  if (input.hostUserId !== input.guestUserId) {
    void payload(input.hostUserId, true).catch((err) => console.error('[OH_PUSH] cancel host failed', err));
  }
}
