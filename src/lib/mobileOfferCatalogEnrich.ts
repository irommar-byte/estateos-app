import { getCanonicalOfferPricePln } from '@/lib/money/offerPrice';
import { computePriceDiscountPercent } from '@/lib/offerPriceHistoryShared';
import { trimOfferForMobileCatalog } from '@/lib/mobileOfferCatalogTrim';

/** Lekkie pola cenowe dla katalogu — bez zapytań do OfferPriceHistory. */
export function enrichCatalogOfferPriceFields(offer: Record<string, unknown>): Record<string, unknown> {
  const current = getCanonicalOfferPricePln(offer as { pricePln?: number; price?: number });
  const listRaw = Number(offer.listPricePln);
  const listPricePln = Number.isFinite(listRaw) && listRaw > 0 ? listRaw : current;
  const discountPercent = computePriceDiscountPercent(listPricePln, current);
  const isDiscounted = discountPercent != null && discountPercent > 0;

  return {
    ...offer,
    listPricePln,
    previousPrice: isDiscounted ? listPricePln : null,
    oldPrice: isDiscounted ? listPricePln : null,
    priceDiscountPercent: discountPercent,
    isDiscounted,
  };
}

export function shapeOfferForMobileCatalog(offer: Record<string, unknown>): Record<string, unknown> {
  const user = offer.user && typeof offer.user === 'object'
    ? (() => {
        const u = offer.user as Record<string, unknown>;
        return {
          id: u.id,
          name: u.name,
          image: u.image,
          role: u.role,
          planType: u.planType,
          isPro: u.isPro,
        };
      })()
    : offer.user;

  const shaped = enrichCatalogOfferPriceFields({
    ...offer,
    user,
    isTwoLevel: !!(offer.isDuplex ?? offer.isTwoLevel),
  });

  return trimOfferForMobileCatalog(shaped);
}
