import { resolveEliteBadges } from '@/lib/eliteStatus';
import { extractVerificationMeta } from '@/lib/offerVerification';
import { computePublicLegalFields } from '@/lib/offerLegalPublicShape';
import { applyLegalStatusOverride, type LegalStatusOverride } from '@/lib/offerLegalStatusOverlay';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { enrichOfferMoneyFieldsWithRate } from '@/lib/money/offerPrice';
import { enrichOfferPriceDiscountFields } from '@/lib/offerPriceHistory';
import { enrichOfferWithLegalAliases } from '@/lib/mobileOfferLegalPayload';
import { resolveSellerDisplayName, resolveSellerPersonName } from '@/lib/sellerDisplay';
import { formatOfferPropertyType, formatOfferCondition } from '@/lib/offerDisplayLabels';
import { resolvePersistedLocalityFields } from '@/lib/offerLocalityCountry';

export type PublicListOffer = Record<string, unknown> & {
  id: number;
  imageUrl: string | null;
  badges: Record<string, boolean>;
  views: number;
  viewsCount: number;
  description?: string;
  apartmentNumber?: string;
  landRegistryNumber?: string;
};

export type PublicListFx = {
  rate: number;
  date: string | null;
};

/** Jednolity kształt oferty na liście publicznej (WWW + mobile). */
export function shapePublicListOffer(
  offer: Record<string, unknown>,
  options: {
    viewsCount?: number;
    fx?: PublicListFx;
    legalOverrides?: Map<number, LegalStatusOverride> | null;
    includeMobileLegalAliases?: boolean;
  } = {},
): PublicListOffer {
  const viewsCount = options.viewsCount ?? 0;
  const fx = options.fx;
  const withLegal = options.legalOverrides
    ? applyLegalStatusOverride(offer, options.legalOverrides)
    : offer;

  const user = (withLegal as { user?: unknown }).user;
  const sellerDisplayName = user ? resolveSellerDisplayName(user) : '';
  const sellerPersonName = user ? resolveSellerPersonName(user) : null;
  const { user: _u, ...rest } = withLegal as Record<string, unknown> & { user?: unknown };
  const elite = resolveEliteBadges({ user });
  const badges = {
    ...elite,
    isPartner: elite.isProgramPartner || elite.isAgent,
  };

  const { cleanDescription, verification } = extractVerificationMeta(rest.description);
  const legal = computePublicLegalFields({
    description: rest.description as string | null | undefined,
    legalCheckStatus: rest.legalCheckStatus as string | null | undefined,
    isLegalSafeVerified: rest.isLegalSafeVerified as boolean | null | undefined,
  });

  const localityResolved = resolvePersistedLocalityFields({
    localityCountry: rest.localityCountry,
    localityCountryCode: rest.localityCountryCode,
    city: rest.city,
    lat: rest.lat,
    lng: rest.lng,
  });

  const base = {
    ...rest,
    localityCountry: localityResolved.localityCountry,
    localityCountryCode: localityResolved.localityCountryCode,
    sellerDisplayName,
    sellerPersonName,
    propertyTypeLabel: formatOfferPropertyType(rest.propertyType, 'pl'),
    propertyTypeLabelEn: formatOfferPropertyType(rest.propertyType, 'en'),
    conditionLabel: formatOfferCondition(rest.condition, 'pl'),
    conditionLabelEn: formatOfferCondition(rest.condition, 'en'),
    imageUrl: resolveOfferPrimaryImage(rest),
    description: cleanDescription,
    apartmentNumber: verification.apartmentNumber || rest.buildingNumber || '',
    landRegistryNumber: verification.landRegistryNumber || '',
    ...legal,
    badges,
    views: viewsCount,
    viewsCount,
  };

  const withMoney = fx
    ? enrichOfferMoneyFieldsWithRate(base, fx.rate, fx.date)
    : base;

  if (options.includeMobileLegalAliases) {
    return enrichOfferWithLegalAliases(enrichOfferPriceDiscountFields(withMoney)) as unknown as PublicListOffer;
  }

  return enrichOfferPriceDiscountFields(withMoney) as unknown as PublicListOffer;
}

export async function loadOfferViewCounts(
  prisma: { $queryRawUnsafe: (query: string) => Promise<unknown> },
  offerIds: number[],
): Promise<Map<number, number>> {
  if (!offerIds.length) return new Map();
  const viewsRows = (await prisma.$queryRawUnsafe(
    `
      SELECT offerId, COUNT(*) AS total
      FROM OfferViewLog
      WHERE offerId IN (${offerIds.join(',')})
      GROUP BY offerId
    `,
  )) as Array<{ offerId: number; total: number }>;
  return new Map(viewsRows.map((row) => [Number(row.offerId), Number(row.total || 0)]));
}
