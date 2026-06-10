import { resolveOfferListingPrice } from '../money/offerPrice';
import { formatAmountWithCurrency } from '../money/format';
import type { ListingCurrency } from '../money/types';

export type OfferPriceDiscountMeta = {
  isDiscounted: boolean;
  discountPercent: number;
  listPricePln: number;
};

export function resolveOfferPriceDiscount(raw: unknown): OfferPriceDiscountMeta {
  if (!raw || typeof raw !== 'object') {
    return { isDiscounted: false, discountPercent: 0, listPricePln: 0 };
  }
  const o = raw as Record<string, unknown>;
  const discountPercent = Number(o.priceDiscountPercent) || 0;
  const listPricePln = Number(o.listPricePln ?? o.previousPrice ?? o.oldPrice) || 0;
  const flagged = Boolean(o.isDiscounted);
  const isDiscounted = flagged && discountPercent > 0 && listPricePln > 0;
  return { isDiscounted, discountPercent, listPricePln };
}

export function formatListedPriceLabel(
  raw: unknown,
  rate: number,
  displayPreference: 'LISTING' | 'PLN' | 'EUR',
): string | null {
  const { isDiscounted, listPricePln } = resolveOfferPriceDiscount(raw);
  if (!isDiscounted || listPricePln <= 0) return null;
  const listing = resolveOfferListingPrice(
    { ...raw, pricePln: listPricePln, price: listPricePln, priceCurrency: 'PLN' },
    rate,
  );
  const currency = (String((raw as Record<string, unknown>).priceCurrency || 'PLN').toUpperCase() === 'EUR'
    ? 'EUR'
    : 'PLN') as ListingCurrency;
  if (displayPreference === 'PLN') {
    return formatAmountWithCurrency(Math.round(listPricePln), 'PLN');
  }
  if (displayPreference === 'EUR') {
    const eur = Math.round(listPricePln / rate);
    return formatAmountWithCurrency(eur, 'EUR');
  }
  if (currency === 'EUR') {
    const amount = Number((raw as Record<string, unknown>).price ?? listPricePln);
    const ratio = listing.plnAmount > 0 ? listPricePln / listing.plnAmount : 1;
    const listInListing = Math.round(amount * ratio);
    return formatAmountWithCurrency(listInListing, currency);
  }
  return formatAmountWithCurrency(Math.round(listPricePln), 'PLN');
}
