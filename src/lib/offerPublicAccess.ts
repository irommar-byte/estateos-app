import type { PrismaClient } from '@prisma/client';
import { activePublicationOfferIds } from '@/lib/offerPublication';
import { canShowOfferOnPublicMarket } from '@/lib/offerMarketVisibility';

type OfferVisibilityRow = {
  id: number;
  userId: number;
  status: unknown;
  expiresAt?: Date | string | null;
};

export async function resolveOfferDetailAccess(
  db: PrismaClient,
  offer: OfferVisibilityRow | null,
  viewer?: { userId?: number | null; role?: string | null },
): Promise<{ allowed: boolean; notFound: boolean }> {
  if (!offer) return { allowed: false, notFound: true };

  const activeIds = await activePublicationOfferIds([Number(offer.id)]);
  const isPublic = canShowOfferOnPublicMarket(
    { id: offer.id, status: offer.status, expiresAt: offer.expiresAt },
    activeIds,
  );
  const viewerId = Number(viewer?.userId);
  const isOwner = Number.isFinite(viewerId) && viewerId > 0 && Number(offer.userId) === viewerId;
  const isAdmin = String(viewer?.role || '').toUpperCase() === 'ADMIN';

  return { allowed: isPublic || isOwner || isAdmin, notFound: false };
}
