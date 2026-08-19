import { prisma } from "@/lib/prisma";
import { logWalletCreditConsume } from "@/lib/walletLedger";
import { ensureCarsStorage } from "@/lib/carsStorage";
import { notifyLinkedClientsOfferFeatured } from "@/lib/crm/sellerSaleUpdates";

export const FEATURED_PROMOTION_DAYS = 7;
export const FEATURED_PROMOTION_MAX_CREDITS = 12;

export function isPromotionActive(until: Date | string | null | undefined): boolean {
  if (!until) return false;
  const date = until instanceof Date ? until : new Date(until);
  return Number.isFinite(date.getTime()) && date.getTime() > Date.now();
}

export function normalizePromotionCredits(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(FEATURED_PROMOTION_MAX_CREDITS, n);
}

export async function consumeOnePublicationCredit(userId: number): Promise<boolean> {
  return consumePublicationCredits(userId, 1);
}

export async function consumePublicationCredits(userId: number, credits: number): Promise<boolean> {
  const amount = normalizePromotionCredits(credits);
  const consumed = await prisma.$executeRawUnsafe(
    `
      UPDATE \`User\`
      SET extraListings = GREATEST(0, extraListings - ?)
      WHERE id = ?
        AND extraListings >= ?
        AND plusExpiresAt IS NOT NULL
        AND plusExpiresAt > NOW(3)
    `,
    amount,
    userId,
    amount,
  );
  return Number(consumed || 0) >= 1;
}

function resolvePromotedUntil(existing: Date | string | null | undefined, credits: number): Date {
  const amount = normalizePromotionCredits(credits);
  const base =
    existing && isPromotionActive(existing)
      ? existing instanceof Date
        ? new Date(existing.getTime())
        : new Date(existing)
      : new Date();
  if (!Number.isFinite(base.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + FEATURED_PROMOTION_DAYS * amount);
    return fallback;
  }
  base.setDate(base.getDate() + FEATURED_PROMOTION_DAYS * amount);
  return base;
}

export async function promoteOfferListing(params: {
  userId: number;
  offerId: number;
  credits?: number;
}) {
  const credits = normalizePromotionCredits(params.credits);
  const offer = await prisma.offer.findUnique({
    where: { id: params.offerId },
    select: { id: true, userId: true, status: true, promotedUntil: true },
  });
  if (!offer || offer.userId !== params.userId) {
    throw new Error("Brak dostępu do tej oferty.");
  }
  if (offer.status !== "ACTIVE") {
    throw new Error("Wyróżnić można tylko aktywne ogłoszenie na rynku.");
  }

  const consumed = await consumePublicationCredits(params.userId, credits);
  if (!consumed) {
    throw new Error("Brak aktywnego kredytu publikacji. Kup Pakiet + lub użyj kredytów z PRO.");
  }

  const promotedUntil = resolvePromotedUntil(offer.promotedUntil, credits);

  await prisma.offer.update({
    where: { id: params.offerId },
    data: { promotedUntil },
  });

  await logWalletCreditConsume({
    userId: params.userId,
    purpose: "featured_promotion",
    referenceType: "offer",
    referenceId: String(params.offerId),
    label: "Wyróżnienie ogłoszenia w katalogu",
    meta: { days: FEATURED_PROMOTION_DAYS * credits, credits },
    amount: credits,
  });

  await notifyLinkedClientsOfferFeatured({
    offerId: params.offerId,
    agencyUserId: params.userId,
    until: promotedUntil,
    days: FEATURED_PROMOTION_DAYS * credits,
  }).catch((error) => {
    console.error("[listingPromotion.featured.notify]", error);
  });

  return { promotedUntil: promotedUntil.toISOString(), credits, days: FEATURED_PROMOTION_DAYS * credits };
}

export async function promoteCarListing(params: {
  userId: number;
  carId: number;
  credits?: number;
}) {
  const credits = normalizePromotionCredits(params.credits);
  await ensureCarsStorage();
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: number; userId: number | null; promotedUntil: Date | string | null }>
  >(`SELECT id, userId, promotedUntil FROM CarListing WHERE id = ? LIMIT 1`, params.carId);
  const car = rows[0];
  if (!car || Number(car.userId) !== params.userId) {
    throw new Error("Brak dostępu do tego ogłoszenia.");
  }

  const consumed = await consumePublicationCredits(params.userId, credits);
  if (!consumed) {
    throw new Error("Brak aktywnego kredytu publikacji. Kup Pakiet + lub użyj kredytów z PRO.");
  }

  const promotedUntil = resolvePromotedUntil(car.promotedUntil, credits);

  await prisma.$executeRawUnsafe(
    `UPDATE CarListing SET promotedUntil = ?, updatedAt = NOW(3) WHERE id = ?`,
    promotedUntil,
    params.carId,
  );

  await logWalletCreditConsume({
    userId: params.userId,
    purpose: "featured_promotion",
    referenceType: "car_listing",
    referenceId: String(params.carId),
    label: "Wyróżnienie ogłoszenia auta w katalogu",
    meta: { days: FEATURED_PROMOTION_DAYS * credits, credits },
    amount: credits,
  });

  return { promotedUntil: promotedUntil.toISOString(), credits, days: FEATURED_PROMOTION_DAYS * credits };
}
