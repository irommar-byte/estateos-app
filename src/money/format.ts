import type { DisplayCurrencyPreference, ListingCurrency } from './types';
import { DEFAULT_EUR_PLN_RATE } from './constants';
import { listingAmountFromPln, normalizeListingCurrency, plnFromListingAmount } from './convert';

export function formatCurrencySuffix(currency: ListingCurrency): string {
  return currency === 'EUR' ? '€' : 'zł';
}

export function formatAmountWithCurrency(amount: number, currency: ListingCurrency): string {
  if (!Number.isFinite(amount) || amount <= 0) return 'Cena na zapytanie';
  const n = Math.round(amount).toLocaleString('pl-PL');
  return `${n} ${formatCurrencySuffix(currency)}`;
}

/** Krótka etykieta na pinezkę mapy, np. „150k €" lub „648k zł". */
export function formatMarkerPriceCompact(amount: number, currency: ListingCurrency): string {
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  const suffix = formatCurrencySuffix(currency);
  if (amount >= 1_000_000) {
    const mln = amount / 1_000_000;
    return `${mln >= 10 ? mln.toFixed(0) : mln.toFixed(1)}M ${suffix}`;
  }
  if (amount >= 1000) return `${Math.round(amount / 1000)}k ${suffix}`;
  return `${Math.round(amount)} ${suffix}`;
}

export function resolveOfferDisplayAmount(params: {
  amount: number;
  listingCurrency?: unknown;
  pricePln?: number | null;
  displayPreference: DisplayCurrencyPreference;
  rate: number;
}): {
  displayAmount: number;
  displayCurrency: ListingCurrency;
  listingCurrency: ListingCurrency;
  listingAmount: number;
  plnAmount: number;
} {
  const listingCurrency = normalizeListingCurrency(params.listingCurrency);
  const listingAmount = Number.isFinite(params.amount) && params.amount > 0 ? params.amount : 0;
  const plnAmount =
    params.pricePln != null && Number.isFinite(Number(params.pricePln)) && Number(params.pricePln) > 0
      ? Math.round(Number(params.pricePln))
      : plnFromListingAmount(listingAmount, listingCurrency, params.rate);

  if (listingAmount <= 0) {
    return {
      displayAmount: 0,
      displayCurrency: listingCurrency,
      listingCurrency,
      listingAmount: 0,
      plnAmount: 0,
    };
  }

  const pref = params.displayPreference;
  const showListing = pref === 'LISTING' || pref === listingCurrency;
  const displayCurrency: ListingCurrency = showListing
    ? listingCurrency
    : pref === 'EUR'
      ? 'EUR'
      : 'PLN';

  const displayAmount =
    displayCurrency === listingCurrency
      ? listingAmount
      : displayCurrency === 'PLN'
        ? plnAmount
        : listingAmountFromPln(plnAmount, 'EUR', params.rate);

  return {
    displayAmount,
    displayCurrency,
    listingCurrency,
    listingAmount,
    plnAmount,
  };
}

export function formatApproxLine(
  amount: number,
  currency: ListingCurrency,
  rate: number,
): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const r = rate > 0 ? rate : DEFAULT_EUR_PLN_RATE;
  if (currency === 'PLN') {
    const eur = listingAmountFromPln(amount, 'EUR', r);
    return `≈ ${formatAmountWithCurrency(eur, 'EUR')}`;
  }
  const pln = plnFromListingAmount(amount, 'EUR', r);
  return `≈ ${formatAmountWithCurrency(pln, 'PLN')}`;
}

export type FormattedOfferPrice = {
  primary: string;
  secondary: string | null;
  listingCurrency: ListingCurrency;
  listingAmount: number;
  plnAmount: number;
};

export function formatOfferPriceDisplay(params: {
  amount: number;
  listingCurrency?: unknown;
  pricePln?: number | null;
  displayPreference: DisplayCurrencyPreference;
  rate: number;
  rateDate?: string;
}): FormattedOfferPrice {
  const resolved = resolveOfferDisplayAmount(params);
  const { listingCurrency, listingAmount, plnAmount, displayAmount, displayCurrency } = resolved;

  if (listingAmount <= 0) {
    return {
      primary: 'Cena na zapytanie',
      secondary: null,
      listingCurrency,
      listingAmount: 0,
      plnAmount: 0,
    };
  }

  const primary = formatAmountWithCurrency(displayAmount, displayCurrency);

  let secondary: string | null = null;
  if (displayCurrency !== listingCurrency) {
    secondary = `W ofercie: ${formatAmountWithCurrency(listingAmount, listingCurrency)}`;
  } else {
    secondary = formatApproxLine(listingAmount, listingCurrency, params.rate);
  }
  return { primary, secondary, listingCurrency, listingAmount, plnAmount };
}

export function formatOfferSecondaryAmount(params: {
  amount: number;
  listingCurrency?: unknown;
  pricePln?: number | null;
  displayPreference: DisplayCurrencyPreference;
  rate: number;
}): string {
  const resolved = resolveOfferDisplayAmount(params);
  return formatAmountWithCurrency(resolved.displayAmount, resolved.displayCurrency);
}
