import { prisma } from '@/lib/prisma';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import {
  canClosePresentation,
  counterpartyId,
  isDealParticipant,
  isReviewableOutcome,
} from '@/lib/appointments/presentationFlow';

export type PendingPresentationPayload = {
  step: 'outcome' | 'review';
  appointment: {
    id: number;
    dealId: number;
    status: string;
    proposedDate: Date;
    outcomeAt: Date | null;
    offer: {
      id: number;
      title: string | null;
      district: string | null;
      city: string | null;
      imageUrl: string | null;
    } | null;
    counterparty: { id: number; name: string; image: string | null };
    viewerRole: 'buyer' | 'seller';
  };
};

export async function getPendingPresentationStep(
  userId: number,
): Promise<PendingPresentationPayload | null> {
  const appointments = await prisma.appointment.findMany({
    where: {
      deal: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      status: { in: ['ACCEPTED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'] },
    },
    include: {
      deal: {
        include: {
          offer: {
            select: {
              id: true,
              title: true,
              district: true,
              city: true,
              images: true,
            },
          },
          buyer: { select: { id: true, name: true, email: true, image: true } },
          seller: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
    orderBy: { proposedDate: 'desc' },
    take: 40,
  });

  for (const app of appointments) {
    if (!isDealParticipant(app.deal, userId)) continue;
    if (canClosePresentation(app)) {
      const counterparty = app.deal.buyerId === userId ? app.deal.seller : app.deal.buyer;
      return {
        step: 'outcome',
        appointment: serialize(app, userId, counterparty),
      };
    }
  }

  for (const app of appointments) {
    if (!isReviewableOutcome(app.status)) continue;
    if (!isDealParticipant(app.deal, userId)) continue;
    const existing = await prisma.review.findFirst({
      where: { appointmentId: app.id, reviewerId: userId },
    });
    if (existing) continue;
    const counterparty = app.deal.buyerId === userId ? app.deal.seller : app.deal.buyer;
    return {
      step: 'review',
      appointment: serialize(app, userId, counterparty),
    };
  }

  return null;
}

function serialize(
  app: any,
  viewerId: number,
  counterparty: { id: number; name: string | null; email: string | null; image?: string | null },
): PendingPresentationPayload['appointment'] {
  const offer = app.deal?.offer;
  return {
    id: app.id,
    dealId: app.dealId,
    status: app.status,
    proposedDate: app.proposedDate,
    outcomeAt: app.outcomeAt,
    offer: offer
      ? {
          id: offer.id,
          title: offer.title,
          district: offer.district,
          city: offer.city,
          imageUrl: resolveOfferPrimaryImage(offer),
        }
      : null,
    counterparty: {
      id: counterparty.id,
      name:
        counterparty.name ||
        (counterparty.email ? counterparty.email.split('@')[0] : 'Kontrahent'),
      image: counterparty.image ?? null,
    },
    viewerRole: app.deal.buyerId === viewerId ? 'buyer' : 'seller',
  };
}
