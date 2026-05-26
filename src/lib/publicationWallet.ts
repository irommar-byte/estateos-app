import { prisma } from "@/lib/prisma";
import { listProfilePromoCardsForUser } from "@/lib/profilePromoCards";
import { PAKIET_PLUS_PRICE_LABEL, PUBLICATION_DURATION_DAYS } from "@/lib/publicationConstants";

function hasPlusCredit(user: { extraListings?: number | null; plusExpiresAt?: Date | string | null }) {
  const credits = Number(user?.extraListings ?? 0);
  if (!Number.isFinite(credits) || credits <= 0) return false;
  if (!user?.plusExpiresAt) return false;
  return new Date(user.plusExpiresAt).getTime() > Date.now();
}

export async function getPublicationWallet(userId: number, locale: "pl" | "en" = "pl") {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      extraListings: true,
      plusExpiresAt: true,
    },
  });
  if (!user) throw new Error("USER_NOT_FOUND");

  const firstFreeRows = (await prisma.$queryRawUnsafe<Array<{ firstFreePublicationUsed: number }>>(
    "SELECT firstFreePublicationUsed FROM `User` WHERE id = ? LIMIT 1",
    userId,
  )) as Array<{ firstFreePublicationUsed: number }>;
  const firstFreeUsed = Number(firstFreeRows[0]?.firstFreePublicationUsed ?? 0) > 0;

  const promoCards = await listProfilePromoCardsForUser(userId);
  const activeCoupons = promoCards.filter(
    (c) => !c.couponUsed && (c.grantsFreeListing || c.purpose === "publication"),
  );

  const coupons = [...activeCoupons];

  if (!firstFreeUsed && !coupons.some((c) => c.kind === "welcome_coupon")) {
    coupons.unshift({
      id: `welcome_${userId}`,
      kind: "welcome_coupon",
      title: locale === "pl" ? "Kupon powitalny" : "Welcome coupon",
      subtitle:
        locale === "pl"
          ? "Jedna darmowa publikacja pierwszej oferty"
          : "One free publication of your first listing",
      meta:
        locale === "pl"
          ? "Gotowy do wykorzystania przy pierwszym wystawieniu."
          : "Ready to use on your first listing.",
      accentColor: "#0A84FF",
      iconName: "sparkles",
      pillLabel: locale === "pl" ? "Powitalny" : "Welcome",
      templateId: "welcome_free_listing",
      grantsFreeListing: true,
      couponUsed: false,
      purpose: "publication",
      birthdayYear: undefined,
      createdAt: new Date().toISOString(),
    });
  }

  const plusActive = hasPlusCredit(user);
  const credits = plusActive ? Number(user.extraListings ?? 0) : 0;
  const expiresAt = user.plusExpiresAt ? new Date(user.plusExpiresAt).toISOString() : null;

  return {
    plusCredits: credits,
    plusExpiresAt: expiresAt,
    hasPlusCredit: plusActive,
    coupons,
    couponCount: coupons.length,
    priceLabel: PAKIET_PLUS_PRICE_LABEL,
    publicationDays: PUBLICATION_DURATION_DAYS,
    firstFreePublicationUsed: firstFreeUsed,
  };
}
