/** Waluta wpisana przy ofercie (sprzedający). */
export type ListingCurrency = 'PLN' | 'EUR';

/** Preferencja użytkownika przy oglądaniu list. */
export type DisplayCurrencyPreference = 'PLN' | 'EUR' | 'LISTING';

export type FxRateSnapshot = {
  rate: number;
  date: string;
  source?: string;
};
