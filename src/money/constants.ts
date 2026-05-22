import type { ListingCurrency } from './types';

/** Fallback gdy API kursu niedostępne (NBP ~2026). */
export const DEFAULT_EUR_PLN_RATE = 4.32;

export const CURRENCY_SYMBOL: Record<ListingCurrency, string> = {
  PLN: 'PLN',
  EUR: 'EUR',
};

export const DISPLAY_CURRENCY_LABELS: Record<'PLN' | 'EUR' | 'LISTING', string> = {
  PLN: 'Złotówki (PLN)',
  EUR: 'Euro (EUR)',
  LISTING: 'Waluta oferty',
};
