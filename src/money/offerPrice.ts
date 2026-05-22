import type { ListingCurrency } from './types';
import { normalizeListingCurrency, plnFromListingAmount } from './convert';
import { DEFAULT_EUR_PLN_RATE } from './constants';

export function parseOfferNumericPrice(raw: unknown): number {
  if (raw == null) return NaN;
  if (typeof raw === 'number') return raw;
  const s = String(raw).replace(/\s/g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function resolveOfferListingPrice(offer: unknown, rate = DEFAULT_EUR_PLN_RATE): {
  amount: number;
  currency: ListingCurrency;
  plnAmount: number;
} {
  if (!offer || typeof offer !== 'object') {
    return { amount: 0, currency: 'PLN', plnAmount: 0 };
  }
  const o = offer as Record<string, unknown>;
  const currency = normalizeListingCurrency(o.priceCurrency ?? o.price_currency ?? o.currency);
  const amount = parseOfferNumericPrice(
    o.priceAmount ?? o.price_amount ?? o.price ?? o.listingPrice,
  );
  const plnFromApi = parseOfferNumericPrice(o.pricePln ?? o.price_pln);
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

/** Pola do POST/PUT oferty (kanoniczne + kompat z `price`). */
export function buildOfferPricePayload(params: {
  priceString: string;
  priceCurrency: ListingCurrency;
  rate: number;
}): {
  price: string;
  priceAmount: number;
  priceCurrency: ListingCurrency;
  pricePln: number;
} {
  const amount = parseOfferNumericPrice(params.priceString);
  const safe = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
  const pricePln = plnFromListingAmount(safe, params.priceCurrency, params.rate);
  return {
    price: String(safe),
    priceAmount: safe,
    priceCurrency: params.priceCurrency,
    pricePln,
  };
}
