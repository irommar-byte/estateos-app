import { prisma } from "@/lib/prisma";
import { logWalletCreditConsume } from "@/lib/walletLedger";
import { ensureCarsStorage } from "@/lib/carsStorage";

export const FEATURED_PROMOTION_DAYS = 7;

export function isPromotionActive(until: Date | string | null | undefined): boolean {
  if (!until) return false;
  const date = until instanceof Date ? until : new Date(until);
  return Number.isFinite(date.getTime()) && date.getTime() > Date.now();
}

export async function consumeOnePublicationCredit(userId: number): Promise<boolean> {
  const consumed = await prisma.$executeRawUnsafe(
    `
      UPDATE \`User\`
      SET extraListings = GREATEST(0, extraListings - 1)
      WHERE id = ?
        AND extraListings > 0
        AND plusExpiresAt IS NOT NULL
        AND plusExpiresAt > NOW(3)
    `,
    userId,
  );
  return Number(consumed || 0) >= 1;
}

export async function promoteOfferListing(params: { userId: number; offerId: number }) {
  const offer = await prisma.offer.findUnique({
    where: { id: params.offerId },
    select: { id: true, userId: true, status: true },
  });
  if (!offer || offer.userId !== params.userId) {
    throw new Error("Brak dostępu do tej oferty.");
  }
  if (offer.status !== "ACTIVE") {
    throw new Error("Wyróżnić można tylko aktywne ogłoszenie na rynku.");
  }

  const consumed = await consumeOnePublicationCredit(params.userId);
  if (!consumed) {
    throw new Error("Brak aktywnego kredytu publikacji. Kup Pakiet + lub użyj kredytów z PRO.");
  }

  const promotedUntil = new Date();
  promotedUntil.setDate(promotedUntil.getDate() + FEATURED_PROMOTION_DAYS);

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
    meta: { days: FEATURED_PROMOTION_DAYS },
  });

  return { promotedUntil: promotedUntil.toISOString() };
}

export async function promoteCarListing(params: { userId: number; carId: number }) {
  await ensureCarsStorage();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number; userId: number | null }>>(
    `SELECT id, userId FROM CarListing WHERE id = ? LIMIT 1`,
    params.carId,
  );
  const car = rows[0];
  if (!car || Number(car.userId) !== params.userId) {
    throw new Error("Brak dostępu do tego ogłoszenia.");
  }

  const consumed = await consumeOnePublicationCredit(params.userId);
  if (!consumed) {
    throw new Error("Brak aktywnego kredytu publikacji. Kup Pakiet + lub użyj kredytów z PRO.");
  }

  const promotedUntil = new Date();
  promotedUntil.setDate(promotedUntil.getDate() + FEATURED_PROMOTION_DAYS);

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
    meta: { days: FEATURED_PROMOTION_DAYS },
  });

  return { promotedUntil: promotedUntil.toISOString() };
}
