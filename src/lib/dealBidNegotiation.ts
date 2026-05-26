import type { PrismaClient, Bid } from '@prisma/client';

export type DealNegotiationSnapshot = {
  respondToBidId: number | null;
  respondToBidAmount: number | null;
  respondToBidSenderId: number | null;
  waitingOnOther: boolean;
  myPendingBidId: number | null;
  myPendingBidAmount: number | null;
};

export async function getDealBidNegotiationSnapshot(
  prisma: PrismaClient,
  dealId: number,
  userId: number
): Promise<DealNegotiationSnapshot> {
  const pendingFromOther = await prisma.bid.findFirst({
    where: { dealId, status: 'PENDING', senderId: { not: userId } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, amount: true, senderId: true },
  });
  const pendingFromMe = await prisma.bid.findFirst({
    where: { dealId, status: 'PENDING', senderId: userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, amount: true },
  });

  return {
    respondToBidId: pendingFromOther?.id ?? null,
    respondToBidAmount: pendingFromOther?.amount ?? null,
    respondToBidSenderId: pendingFromOther?.senderId ?? null,
    waitingOnOther: !!pendingFromMe && !pendingFromOther,
    myPendingBidId: pendingFromMe?.id ?? null,
    myPendingBidAmount: pendingFromMe?.amount ?? null,
  };
}

/**
 * Wybiera aktywną ofertę drugiej strony (PENDING). Gdy klient poda zły bidId
 * (np. własną kontrofertę z eventu bez senderId), przekierowujemy na właściwy rekord.
 */
export async function resolveBidForResponse(
  prisma: PrismaClient,
  dealId: number,
  actorId: number,
  requestedBidId?: number | null
): Promise<Bid> {
  const findOtherPending = () =>
    prisma.bid.findFirst({
      where: { dealId, status: 'PENDING', senderId: { not: actorId } },
      orderBy: { createdAt: 'desc' },
    });

  if (requestedBidId && Number.isFinite(requestedBidId) && requestedBidId > 0) {
    const requested = await prisma.bid.findUnique({ where: { id: requestedBidId } });
    if (requested && requested.dealId === dealId) {
      if (requested.status === 'PENDING' && requested.senderId !== actorId) {
        return requested;
      }
      const alt = await findOtherPending();
      if (alt) return alt;
      if (requested.senderId === actorId) {
        throw new Error('OWN_BID_PENDING');
      }
      throw new Error('BID_ALREADY_HANDLED');
    }
  }

  const pending = await findOtherPending();
  if (pending) return pending;
  throw new Error('NO_PENDING_BID');
}
