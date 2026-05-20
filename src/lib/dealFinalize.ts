import type { Prisma } from '@prisma/client';
import { endOfferPublicationInTx } from '@/lib/offerPublication';

type Tx = Prisma.TransactionClient;

export type FinalizeDealParams = {
  dealId: number;
  offerId: number;
  sellerId: number;
  buyerId: number;
  actorUserId: number;
  acceptedBidId: number;
  finalPrice?: number | null;
};

/**
 * Atomowo: deal FINALIZED, oferta SOLD, anulowanie konkurencyjnych deali, komunikaty systemowe.
 * Wywoływane z finalnej akceptacji właściciela (mobile) lub POST …/finalize (web).
 */
export async function finalizeDealWithOfferArchive(tx: Tx, params: FinalizeDealParams) {
  const { dealId, offerId, sellerId, buyerId, actorUserId, acceptedBidId } = params;

  const updated = await tx.deal.updateMany({
    where: {
      id: dealId,
      status: { notIn: ['FINALIZED', 'CANCELLED'] },
    },
    data: {
      status: 'FINALIZED',
      acceptedBidId,
      isActive: false,
      finalizedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  if (updated.count === 0) {
    throw new Error('DEAL_ALREADY_FINALIZED');
  }

  const publication = await endOfferPublicationInTx(tx, {
    offerId,
    endReason: 'SOLD',
    dealId,
    offerStatus: 'SOLD',
  });

  await tx.dealMessage.create({
    data: {
      dealId,
      senderId: actorUserId,
      content: '[SYSTEM_FINALIZED] Nieruchomość została sprzedana. Gratulacje! 🎉',
    },
  });

  await tx.notification.createMany({
    data: [
      {
        userId: buyerId,
        type: 'SYSTEM_ALERT',
        title: '🎉 Transakcja zakończona',
        body: 'Zakup został sfinalizowany.',
        targetType: 'DEAL',
        targetId: String(dealId),
      },
      {
        userId: sellerId,
        type: 'SYSTEM_ALERT',
        title: '🎉 Transakcja zakończona',
        body: 'Sprzedaż została zakończona sukcesem.',
        targetType: 'DEAL',
        targetId: String(dealId),
      },
    ],
  });

  const otherDeals = await tx.deal.findMany({
    where: {
      offerId,
      id: { not: dealId },
      status: { notIn: ['CANCELLED', 'FINALIZED'] },
    },
    select: { id: true, buyerId: true },
  });

  if (otherDeals.length > 0) {
    await tx.deal.updateMany({
      where: {
        offerId,
        id: { not: dealId },
      },
      data: {
        status: 'CANCELLED',
        isActive: false,
        updatedAt: new Date(),
      },
    });

    await tx.notification.createMany({
      data: otherDeals.map((d) => ({
        userId: d.buyerId,
        type: 'SYSTEM_ALERT',
        title: '❌ Oferta niedostępna',
        body: 'Nieruchomość została sprzedana innemu klientowi.',
        targetType: 'DEAL',
        targetId: String(d.id),
      })),
    });

    await tx.dealMessage.createMany({
      data: otherDeals.map((d) => ({
        dealId: d.id,
        senderId: sellerId,
        content: '[SYSTEM_CANCELLED] Oferta została sprzedana innemu klientowi.',
      })),
    });
  }

  return {
    publicationStatus: publication?.status ?? 'ENDED',
    publicationEndReason: publication?.endReason ?? 'SOLD',
  };
}

export function isOwnerFinalAccept(actorId: number, sellerId: number) {
  return actorId === sellerId;
}
