import { DEFAULT_EUR_PLN_RATE } from './constants';
import { parsePriceAmount } from './offerPrice';
import { normalizeListingCurrency, plnFromListingAmount } from './convert';
import type { ListingCurrency } from './types';

export function resolveOfferListingPrice(
  offer: unknown,
  rate = DEFAULT_EUR_PLN_RATE,
): {
  amount: number;
  currency: ListingCurrency;
  plnAmount: number;
} {
  if (!offer || typeof offer !== 'object') {
    return { amount: 0, currency: 'PLN', plnAmount: 0 };
  }
  const o = offer as Record<string, unknown>;
  const currency = normalizeListingCurrency(o.priceCurrency ?? o.price_currency ?? o.currency);
  const amount = parsePriceAmount(o.priceAmount ?? o.price_amount ?? o.price ?? o.listingPrice);
  const plnFromApi = parsePriceAmount(o.pricePln ?? o.price_pln);
  const plnAmount =
    Number.isFinite(plnFromApi) && plnFromApi > 0
      ? Math.round(plnFromApi)
      : plnFromListingAmount(amount, currency, rate);

  return {
    amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
    currency,
    plnAmount,
  };
}
