import type { DisplayCurrencyPreference, ListingCurrency } from './types';
import {
  convertBetweenCurrencies,
  listingAmountFromPln,
  normalizeListingCurrency,
  plnFromListingAmount,
} from './convert';
import { formatOfferSecondaryAmount } from './format';

/** Czynsz administracyjny w DB jest zawsze w PLN (bez osobnej waluty). */
export function parseAdminFeePln(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  const n =
    typeof raw === 'number'
      ? raw
      : Number(String(raw).replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

export function adminFeeInputFromPln(
  pln: number,
  listingCurrency: ListingCurrency,
  rate: number,
): number {
  if (pln <= 0) return 0;
  return listingAmountFromPln(pln, normalizeListingCurrency(listingCurrency), rate);
}

export function adminFeePlnFromInput(
  amountRaw: unknown,
  listingCurrency: ListingCurrency,
  rate: number,
): number | null {
  const n =
    typeof amountRaw === 'number'
      ? amountRaw
      : Number(String(amountRaw ?? '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return plnFromListingAmount(n, normalizeListingCurrency(listingCurrency), rate) || null;
}

export function convertAdminFeeInput(
  amountRaw: unknown,
  from: ListingCurrency,
  to: ListingCurrency,
  rate: number,
): string {
  const n =
    typeof amountRaw === 'number'
      ? amountRaw
      : Number(String(amountRaw ?? '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return '';
  const converted = convertBetweenCurrencies(n, from, to, rate);
  return converted > 0 ? String(converted) : '';
}

export function formatAdminFeeDisplay(params: {
  adminFeePln: number;
  listingCurrency?: unknown;
  displayPreference: DisplayCurrencyPreference;
  rate: number;
  locale?: 'pl' | 'en';
}): string {
  const pln = parseAdminFeePln(params.adminFeePln);
  if (pln <= 0) return '';
  const listingCurrency = normalizeListingCurrency(params.listingCurrency);
  const amountInListing = listingAmountFromPln(pln, listingCurrency, params.rate);
  return formatOfferSecondaryAmount({
    amount: amountInListing,
    listingCurrency,
    pricePln: pln,
    displayPreference: params.displayPreference,
    rate: params.rate,
    locale: params.locale,
  });
}
