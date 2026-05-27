export type ListingCurrency = 'PLN' | 'EUR';

/** Preferencja wyświetlania cen (jak w aplikacji mobilnej). */
export type DisplayCurrencyPreference = 'PLN' | 'EUR' | 'LISTING';

export type FxRateSnapshot = {
  rate: number;
  date: string;
  source: string;
};
