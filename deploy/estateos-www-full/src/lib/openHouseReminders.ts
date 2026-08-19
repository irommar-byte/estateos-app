import { prisma } from '@/lib/prisma';
import { sendNotification } from '@/lib/core/notification.core';

const WINDOW_MS = 90 * 60 * 1000;

/** Best-effort: ticker is polled often — send one reminder per reservation ~90 min before the slot. */
export async function maybeDispatchOpenHouseReminders(): Promise<void> {
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_MS);

  const slots = await prisma.openHouseSlot.findMany({
    where: {
      startsAt: { gte: now, lte: until },
      event: { status: 'PUBLISHED' },
    },
    select: {
      id: true,
      startsAt: true,
      event: {
        select: {
          id: true,
          hostUserId: true,
          offerId: true,
          title: true,
          offer: { select: { title: true } },
        },
      },
      reservations: {
        where: { status: 'CONFIRMED' },
        select: { id: true, userId: true },
      },
    },
  });

  for (const slot of slots) {
    const when = slot.startsAt.toLocaleString('pl-PL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const label = slot.event.offer?.title?.trim()
      ? `„${slot.event.offer.title.trim().slice(0, 56)}”`
      : slot.event.title || `oferta #${slot.event.offerId}`;

    const hostKey = `oh-remind-host:${slot.id}`;
    void sendNotification({
      userId: slot.event.hostUserId,
      type: 'CRM_EVENT',
      title: 'Dzień otwarty za chwilę',
      body: `${label} · ${when}`,
      data: {
        type: 'OPEN_HOUSE_REMINDER',
        notificationType: 'OPEN_HOUSE',
        offerId: slot.event.offerId,
        eventId: slot.event.id,
        screen: 'OpenHouseEvent',
        deeplink: `estateos://oferta/${slot.event.offerId}`,
      },
      idempotencyKey: hostKey,
    }).catch(() => undefined);

    for (const reservation of slot.reservations) {
      if (reservation.userId === slot.event.hostUserId) continue;
      void sendNotification({
        userId: reservation.userId,
        type: 'CRM_EVENT',
        title: 'Przypomnienie: dzień otwarty',
        body: `${label} · ${when}`,
        data: {
          type: 'OPEN_HOUSE_REMINDER',
          notificationType: 'OPEN_HOUSE',
          offerId: slot.event.offerId,
          eventId: slot.event.id,
          screen: 'OpenHouseEvent',
          deeplink: `estateos://oferta/${slot.event.offerId}`,
        },
        idempotencyKey: `oh-remind-guest:${reservation.id}`,
      }).catch(() => undefined);
    }
  }
}
