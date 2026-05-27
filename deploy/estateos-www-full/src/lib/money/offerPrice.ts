import { DEFAULT_EUR_PLN_RATE } from '@/lib/money/constants';

export { DEFAULT_EUR_PLN_RATE };

export type OfferPriceCurrency = 'PLN' | 'EUR';

export type ResolvedOfferPrice = {
  price: number;
  priceCurrency: OfferPriceCurrency;
  pricePln: number;
  exchangeRateUsed: number | null;
  exchangeRateDate: Date | null;
};

export function normalizePriceCurrency(raw: unknown): OfferPriceCurrency {
  const value = String(raw || 'PLN').trim().toUpperCase();
  return value === 'EUR' ? 'EUR' : 'PLN';
}

export function parsePriceAmount(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.max(0, raw) : 0;
  const normalized = String(raw ?? '')
    .replace(/\s/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

/** Canonical PLN do sortowania i filtrów (zaokrąglenie do 1 PLN). */
export function roundPricePln(value: number): number {
  return Math.round(value);
}

export function getCanonicalOfferPricePln(offer: {
  pricePln?: unknown;
  price?: unknown;
  priceCurrency?: unknown;
}): number {
  const stored = Number(offer.pricePln);
  if (Number.isFinite(stored) && stored > 0) return stored;
  const amount = parsePriceAmount(offer.price);
  const currency = normalizePriceCurrency(offer.priceCurrency);
  if (currency === 'PLN') return roundPricePln(amount);
  return roundPricePln(amount);
}

function formatExchangeRateDate(raw: unknown): string | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Pola money w każdym GET oferty (mobile + web) — bezpieczne po stronie klienta. */
export function enrichOfferMoneyFields<T extends Record<string, unknown>>(offer: T) {
  const priceAmount = parsePriceAmount(offer.price ?? offer.priceAmount);
  const priceCurrency = normalizePriceCurrency(offer.priceCurrency);
  const pricePln = getCanonicalOfferPricePln({
    pricePln: offer.pricePln,
    price: priceAmount,
    priceCurrency,
  });
  const exchangeRateUsed =
    offer.exchangeRateUsed != null && offer.exchangeRateUsed !== ''
      ? Number(offer.exchangeRateUsed)
      : null;

  return {
    ...offer,
    price: priceAmount,
    priceAmount,
    priceCurrency,
    pricePln,
    exchangeRateUsed: Number.isFinite(exchangeRateUsed as number) ? exchangeRateUsed : null,
    exchangeRateDate: formatExchangeRateDate(offer.exchangeRateDate),
  };
}

/** Wersja wsadowa — jeden kurs NBP dla listy ofert (GET /api/offers). */
export function enrichOfferMoneyFieldsWithRate<T extends Record<string, unknown>>(
  offer: T,
  rate: number,
  rateDate: string | null,
) {
  const base = enrichOfferMoneyFields(offer);
  const amount = parsePriceAmount(base.price);
  if (amount <= 0) return base;
  const existing = base.exchangeRateUsed as number | null;
  if (existing != null && existing > 0) return base;
  return {
    ...base,
    exchangeRateUsed: rate > 0 ? rate : DEFAULT_EUR_PLN_RATE,
    exchangeRateDate: rateDate,
  };
}

export function bodyTouchesOfferPrice(body: Record<string, unknown>): boolean {
  return (
    body.price !== undefined ||
    body.priceAmount !== undefined ||
    body.priceCurrency !== undefined
  );
}
