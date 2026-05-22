import { DEFAULT_EUR_PLN_RATE } from './constants';
import type { ListingCurrency } from './types';

export function normalizeListingCurrency(raw: unknown): ListingCurrency {
  const c = String(raw || 'PLN').toUpperCase();
  return c === 'EUR' ? 'EUR' : 'PLN';
}

export function plnFromListingAmount(amount: number, currency: ListingCurrency, rate: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (currency === 'PLN') return Math.round(amount);
  const r = rate > 0 ? rate : DEFAULT_EUR_PLN_RATE;
  return Math.round(amount * r);
}

export function listingAmountFromPln(pln: number, currency: ListingCurrency, rate: number): number {
  if (!Number.isFinite(pln) || pln <= 0) return 0;
  if (currency === 'PLN') return Math.round(pln);
  const r = rate > 0 ? rate : DEFAULT_EUR_PLN_RATE;
  return Math.round(pln / r);
}

export function convertBetweenCurrencies(
  amount: number,
  from: ListingCurrency,
  to: ListingCurrency,
  rate: number,
): number {
  if (from === to) return Math.round(amount);
  if (from === 'EUR' && to === 'PLN') return plnFromListingAmount(amount, 'EUR', rate);
  return listingAmountFromPln(amount, 'EUR', rate);
}

/** Zakres ceny z wyszukiwania rozszerzonego → PLN do porównania z `pricePln` oferty. */
export function advancedPriceBoundsToPln(
  min: number | null,
  max: number | null,
  currency: ListingCurrency,
  rate: number,
): { minPln: number | null; maxPln: number | null } {
  return {
    minPln: min != null && min > 0 ? plnFromListingAmount(min, currency, rate) : null,
    maxPln: max != null && max > 0 ? plnFromListingAmount(max, currency, rate) : null,
  };
}
