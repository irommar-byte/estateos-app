import type { PrismaClient } from '@prisma/client';
import { activePublicationOfferIds } from '@/lib/offerPublication';
import { canShowOfferOnPublicMarket } from '@/lib/offerMarketVisibility';

type OfferVisibilityRow = {
  id: number;
  userId: number;
  status: unknown;
  expiresAt?: Date | string | null;
};

/** Kupujący lub sprzedający w dowolnym dealu powiązanym z ofertą — wgląd prywatny po wycofaniu / SOLD. */
export async function isDealParticipantForOffer(
  db: PrismaClient,
  offerId: number,
  viewerId: number,
): Promise<boolean> {
  if (!Number.isFinite(viewerId) || viewerId <= 0 || !Number.isFinite(offerId) || offerId <= 0) {
    return false;
  }
  const deal = await db.deal.findFirst({
    where: {
      offerId,
      OR: [{ buyerId: viewerId }, { sellerId: viewerId }],
    },
    select: { id: true },
  });
  return Boolean(deal);
}

export async function resolveOfferDetailAccess(
  db: PrismaClient,
  offer: OfferVisibilityRow | null,
  viewer?: { userId?: number | null; role?: string | null },
): Promise<{ allowed: boolean; notFound: boolean; dealParticipant?: boolean }> {
  if (!offer) return { allowed: false, notFound: true };

  const activeIds = await activePublicationOfferIds([Number(offer.id)]);
  const isPublic = canShowOfferOnPublicMarket(
    { id: offer.id, status: offer.status, expiresAt: offer.expiresAt },
    activeIds,
  );
  const viewerId = Number(viewer?.userId);
  const isOwner = Number.isFinite(viewerId) && viewerId > 0 && Number(offer.userId) === viewerId;
  const isAdmin = String(viewer?.role || '').toUpperCase() === 'ADMIN';
  const dealParticipant =
    !isPublic && !isOwner && !isAdmin && Number.isFinite(viewerId)
      ? await isDealParticipantForOffer(db, Number(offer.id), viewerId)
      : false;

  return {
    allowed: isPublic || isOwner || isAdmin || dealParticipant,
    notFound: false,
    dealParticipant,
  };
}
