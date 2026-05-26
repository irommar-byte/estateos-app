import type { PrismaClient, Bid, Appointment, Deal } from '@prisma/client';

export const FINALIZED_DEAL_STATUSES = new Set([
  'FINALIZED',
  'CLOSED',
  'COMPLETED',
  'DONE',
  'SOLD',
  'CANCELLED',
]);

export type DealNegotiationSnapshot = {
  respondToBidId: number | null;
  respondToBidAmount: number | null;
  respondToBidSenderId: number | null;
  waitingOnOtherBid: boolean;
  myPendingBidId: number | null;
  myPendingBidAmount: number | null;
  respondToAppointmentId: number | null;
  respondToAppointmentDate: string | null;
  respondToAppointmentProposerId: number | null;
  waitingOnOtherAppointment: boolean;
  myPendingAppointmentId: number | null;
};

export function isDealClosedForNegotiation(deal: Pick<Deal, 'status' | 'isActive'>): boolean {
  const status = String(deal.status || '').toUpperCase();
  if (FINALIZED_DEAL_STATUSES.has(status)) return true;
  if (!deal.isActive && status !== 'AGREED' && status !== 'NEGOTIATION') return true;
  return false;
}

export function isPriceNegotiationFrozen(deal: Pick<Deal, 'status' | 'acceptedBidId'>): boolean {
  const status = String(deal.status || '').toUpperCase();
  return status === 'AGREED' || !!deal.acceptedBidId;
}

export async function getDealNegotiationSnapshot(
  prisma: PrismaClient,
  dealId: number,
  userId: number
): Promise<DealNegotiationSnapshot> {
  const pendingBidFromOther = await prisma.bid.findFirst({
    where: { dealId, status: 'PENDING', senderId: { not: userId } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, amount: true, senderId: true },
  });
  const pendingBidFromMe = await prisma.bid.findFirst({
    where: { dealId, status: 'PENDING', senderId: userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, amount: true },
  });

  const pendingApptFromOther = await prisma.appointment.findFirst({
    where: { dealId, status: 'PENDING', proposedById: { not: userId } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, proposedDate: true, proposedById: true },
  });
  const pendingApptFromMe = await prisma.appointment.findFirst({
    where: { dealId, status: 'PENDING', proposedById: userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  return {
    respondToBidId: pendingBidFromOther?.id ?? null,
    respondToBidAmount: pendingBidFromOther?.amount ?? null,
    respondToBidSenderId: pendingBidFromOther?.senderId ?? null,
    waitingOnOtherBid: !!pendingBidFromMe && !pendingBidFromOther,
    myPendingBidId: pendingBidFromMe?.id ?? null,
    myPendingBidAmount: pendingBidFromMe?.amount ?? null,
    respondToAppointmentId: pendingApptFromOther?.id ?? null,
    respondToAppointmentDate: pendingApptFromOther?.proposedDate?.toISOString() ?? null,
    respondToAppointmentProposerId: pendingApptFromOther?.proposedById ?? null,
    waitingOnOtherAppointment: !!pendingApptFromMe && !pendingApptFromOther,
    myPendingAppointmentId: pendingApptFromMe?.id ?? null,
  };
}

/** @deprecated use getDealNegotiationSnapshot */
export const getDealBidNegotiationSnapshot = getDealNegotiationSnapshot;

export async function resolveBidForResponse(
  prisma: PrismaClient,
  dealId: number,
  actorId: number,
  requestedBidId?: number | null,
  deal?: Pick<Deal, 'status' | 'acceptedBidId' | 'sellerId'> | null
): Promise<Bid> {
  const findOtherPending = () =>
    prisma.bid.findFirst({
      where: { dealId, status: 'PENDING', senderId: { not: actorId } },
      orderBy: { createdAt: 'desc' },
    });

  if (
    deal &&
    deal.status === 'AGREED' &&
    deal.acceptedBidId &&
    actorId === deal.sellerId
  ) {
    const accepted = await prisma.bid.findUnique({ where: { id: deal.acceptedBidId } });
    if (accepted && accepted.dealId === dealId) {
      return accepted;
    }
  }

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

export async function resolveAppointmentForResponse(
  prisma: PrismaClient,
  dealId: number,
  actorId: number,
  requestedAppointmentId?: number | null
): Promise<Appointment> {
  const findOtherPending = () =>
    prisma.appointment.findFirst({
      where: { dealId, status: 'PENDING', proposedById: { not: actorId } },
      orderBy: { createdAt: 'desc' },
    });

  if (requestedAppointmentId && Number.isFinite(requestedAppointmentId) && requestedAppointmentId > 0) {
    const requested = await prisma.appointment.findUnique({ where: { id: requestedAppointmentId } });
    if (requested && requested.dealId === dealId) {
      if (requested.status === 'PENDING' && requested.proposedById !== actorId) {
        return requested;
      }
      const alt = await findOtherPending();
      if (alt) return alt;
      if (requested.proposedById === actorId) {
        throw new Error('OWN_APPOINTMENT_PENDING');
      }
      throw new Error('APPOINTMENT_ALREADY_HANDLED');
    }
  }

  const pending = await findOtherPending();
  if (pending) return pending;
  throw new Error('NO_PENDING_APPOINTMENT');
}

/** Jedna aktywna propozycja PENDING na stronę — stare wycofujemy przed nową. */
export async function withdrawOwnPendingBids(
  prisma: PrismaClient,
  dealId: number,
  userId: number
) {
  await prisma.bid.updateMany({
    where: { dealId, senderId: userId, status: 'PENDING' },
    data: { status: 'REJECTED' },
  });
}

export async function withdrawOwnPendingAppointments(
  prisma: PrismaClient,
  dealId: number,
  userId: number
) {
  await prisma.appointment.updateMany({
    where: { dealId, proposedById: userId, status: 'PENDING' },
    data: { status: 'DECLINED' },
  });
}
