import type { DisplayCurrencyPreference, ListingCurrency } from './types';
import { DEFAULT_EUR_PLN_RATE } from './constants';
import { listingAmountFromPln, normalizeListingCurrency, plnFromListingAmount } from './convert';

export function formatCurrencySuffix(currency: ListingCurrency, locale: 'pl' | 'en' = 'pl'): string {
  if (currency === 'EUR') return '€';
  return locale === 'en' ? 'PLN' : 'zł';
}

export function formatAmountWithCurrency(
  amount: number,
  currency: ListingCurrency,
  locale: 'pl' | 'en' = 'pl',
): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    return locale === 'en' ? 'Price on request' : 'Cena na zapytanie';
  }
  const n = Math.round(amount).toLocaleString(locale === 'pl' ? 'pl-PL' : 'en-GB');
  return `${n} ${formatCurrencySuffix(currency, locale)}`;
}

export function formatMarkerPriceCompact(
  amount: number,
  currency: ListingCurrency,
  locale: 'pl' | 'en' = 'pl',
): string {
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  const suffix = formatCurrencySuffix(currency, locale);
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
}) {
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
  locale: 'pl' | 'en' = 'pl',
): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const r = rate > 0 ? rate : DEFAULT_EUR_PLN_RATE;
  if (currency === 'PLN') {
    const eur = listingAmountFromPln(amount, 'EUR', r);
    return `≈ ${formatAmountWithCurrency(eur, 'EUR', locale)}`;
  }
  const pln = plnFromListingAmount(amount, 'EUR', r);
  return `≈ ${formatAmountWithCurrency(pln, 'PLN', locale)}`;
}

export function formatOfferSecondaryAmount(params: {
  amount: number;
  listingCurrency?: unknown;
  pricePln?: number | null;
  displayPreference: DisplayCurrencyPreference;
  rate: number;
  locale?: 'pl' | 'en';
}): string {
  const locale = params.locale ?? 'pl';
  const resolved = resolveOfferDisplayAmount(params);
  return formatAmountWithCurrency(resolved.displayAmount, resolved.displayCurrency, locale);
}

export type FormattedOfferPrice = {
  primary: string;
  secondary: string | null;
  listingCurrency: ListingCurrency;
  listingAmount: number;
  plnAmount: number;
  displayCurrency: ListingCurrency;
  displayAmount: number;
};

export function formatOfferPriceDisplay(params: {
  amount: number;
  listingCurrency?: unknown;
  pricePln?: number | null;
  displayPreference: DisplayCurrencyPreference;
  rate: number;
  locale?: 'pl' | 'en';
}): FormattedOfferPrice {
  const locale = params.locale ?? 'pl';
  const resolved = resolveOfferDisplayAmount(params);
  const { listingCurrency, listingAmount, plnAmount, displayAmount, displayCurrency } = resolved;

  if (listingAmount <= 0) {
    return {
      primary: locale === 'en' ? 'Price on request' : 'Cena na zapytanie',
      secondary: null,
      listingCurrency,
      listingAmount: 0,
      plnAmount: 0,
      displayCurrency,
      displayAmount: 0,
    };
  }

  const primary = formatAmountWithCurrency(displayAmount, displayCurrency, locale);

  let secondary: string | null = null;
  if (displayCurrency !== listingCurrency) {
    secondary =
      locale === 'en'
        ? `Listed at: ${formatAmountWithCurrency(listingAmount, listingCurrency, locale)}`
        : `W ofercie: ${formatAmountWithCurrency(listingAmount, listingCurrency, locale)}`;
  } else {
    secondary = formatApproxLine(listingAmount, listingCurrency, params.rate, locale);
  }

  return {
    primary,
    secondary,
    listingCurrency,
    listingAmount,
    plnAmount,
    displayCurrency,
    displayAmount,
  };
}
