import { prisma } from '@/lib/prisma';
import { notificationService } from '@/lib/services/notification.service';

type AuctionNotifyBase = {
  eventId: number;
  offerId: number;
};

async function createInAppNotification(
  userId: number,
  title: string,
  body: string,
  offerId: number,
  idempotencyKey: string
) {
  try {
    await prisma.notification.create({
      data: {
        userId,
        title,
        body,
        type: 'SYSTEM_ALERT',
        priority: 'HIGH',
        targetType: 'OFFER',
        targetId: String(offerId),
        idempotencyKey,
      },
    });
  } catch {
    // duplicate idempotency — ignore
  }
}

export async function notifyAuctionOutbid(input: AuctionNotifyBase & {
  outbidUserId: number;
  newAmount: number;
  currency: string;
}) {
  const title = 'Przebito Twoją ofertę';
  const body = `Ktoś złożył wyższą ofertę: ${Math.round(input.newAmount).toLocaleString('pl-PL')} ${input.currency}.`;
  const key = `auction-outbid-${input.eventId}-${input.outbidUserId}-${Math.round(input.newAmount)}`;

  await createInAppNotification(input.outbidUserId, title, body, input.offerId, key);
  await notificationService.sendPushToUser(
    input.outbidUserId,
    {
      title,
      body,
      data: { type: 'AUCTION_OUTBID', eventId: input.eventId, offerId: input.offerId },
    },
    { offerId: input.offerId }
  );
}

export async function notifyAuctionBidPlaced(input: AuctionNotifyBase & {
  hostUserId: number;
  bidderUserId: number;
  amount: number;
  currency: string;
}) {
  if (input.hostUserId === input.bidderUserId) return;

  const title = 'Nowa oferta w licytacji';
  const body = `Otrzymano ofertę ${Math.round(input.amount).toLocaleString('pl-PL')} ${input.currency}.`;
  const key = `auction-bid-host-${input.eventId}-${Math.round(input.amount)}`;

  await createInAppNotification(input.hostUserId, title, body, input.offerId, key);
  await notificationService.sendPushToUser(
    input.hostUserId,
    {
      title,
      body,
      data: { type: 'AUCTION_BID', eventId: input.eventId, offerId: input.offerId },
    },
    { offerId: input.offerId }
  );
}

export async function notifyAuctionEnded(input: AuctionNotifyBase & {
  hostUserId: number;
  winnerUserId: number;
  finalAmount: number;
  currency: string;
}) {
  const winTitle = 'Wygrałeś licytację!';
  const winBody = `Twoja oferta ${Math.round(input.finalAmount).toLocaleString('pl-PL')} ${input.currency} wygrała. Skontaktuj się ze sprzedającym.`;
  const hostTitle = 'Licytacja zakończona';
  const hostBody = `Zwycięzca złożył ofertę ${Math.round(input.finalAmount).toLocaleString('pl-PL')} ${input.currency}.`;

  await createInAppNotification(
    input.winnerUserId,
    winTitle,
    winBody,
    input.offerId,
    `auction-won-${input.eventId}-${input.winnerUserId}`
  );
  await createInAppNotification(
    input.hostUserId,
    hostTitle,
    hostBody,
    input.offerId,
    `auction-ended-host-${input.eventId}`
  );

  await notificationService.sendPushToUser(
    input.winnerUserId,
    {
      title: winTitle,
      body: winBody,
      data: { type: 'AUCTION_WON', eventId: input.eventId, offerId: input.offerId },
    },
    { offerId: input.offerId }
  );
  await notificationService.sendPushToUser(
    input.hostUserId,
    {
      title: hostTitle,
      body: hostBody,
      data: { type: 'AUCTION_ENDED', eventId: input.eventId, offerId: input.offerId },
    },
    { offerId: input.offerId }
  );
}

export async function notifyAuctionStartingSoon(input: AuctionNotifyBase & {
  hostUserId: number;
  startsAt: Date;
}) {
  const title = 'Licytacja zaplanowana';
  const body = `Twoja licytacja startuje ${input.startsAt.toLocaleString('pl-PL')}.`;
  const key = `auction-scheduled-${input.eventId}`;

  await createInAppNotification(input.hostUserId, title, body, input.offerId, key);
}
