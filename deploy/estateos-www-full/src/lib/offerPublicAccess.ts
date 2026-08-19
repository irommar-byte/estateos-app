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

/** Klient CRM z linku e-mail / panelu — wgląd w ofertę, którą agent mu dopasował albo wysłał. */
export async function isCrmPortalGrantedOfferAccess(
  db: PrismaClient,
  offerId: number,
  portalToken?: string | null,
): Promise<boolean> {
  const token = String(portalToken || '').trim();
  if (!token || token.length < 16 || !Number.isFinite(offerId) || offerId <= 0) return false;
  const client = await db.agencyClient.findFirst({
    where: { portalToken: token, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!client) return false;
  const match = await db.agencyClientMatch.findFirst({
    where: { clientId: client.id, offerId },
    select: { id: true },
  });
  return Boolean(match);
}

export async function resolveOfferDetailAccess(
  db: PrismaClient,
  offer: OfferVisibilityRow | null,
  viewer?: { userId?: number | null; role?: string | null; portalToken?: string | null },
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
  const crmPortal =
    !isPublic && !isOwner && !isAdmin
      ? await isCrmPortalGrantedOfferAccess(db, Number(offer.id), viewer?.portalToken)
      : false;
  const dealParticipant =
    !isPublic && !isOwner && !isAdmin && !crmPortal && Number.isFinite(viewerId)
      ? await isDealParticipantForOffer(db, Number(offer.id), viewerId)
      : false;

  return {
    allowed: isPublic || isOwner || isAdmin || crmPortal || dealParticipant,
    notFound: false,
    dealParticipant,
  };
}
