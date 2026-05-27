import { getNbpEurPlnRate } from '@/lib/money/nbpEurPln';
import {
  DEFAULT_EUR_PLN_RATE,
  enrichOfferMoneyFields,
  normalizePriceCurrency,
  parsePriceAmount,
  roundPricePln,
  type OfferPriceCurrency,
  type ResolvedOfferPrice,
} from '@/lib/money/offerPrice';

export async function resolveOfferPriceFromBody(body: {
  price?: unknown;
  priceAmount?: unknown;
  priceCurrency?: unknown;
}): Promise<ResolvedOfferPrice> {
  const amount = parsePriceAmount(body.priceAmount ?? body.price);
  const priceCurrency = normalizePriceCurrency(body.priceCurrency);

  if (priceCurrency === 'PLN') {
    const pricePln = roundPricePln(amount);
    return {
      price: amount,
      priceCurrency: 'PLN',
      pricePln,
      exchangeRateUsed: null,
      exchangeRateDate: null,
    };
  }

  const fx = await getNbpEurPlnRate();
  const pricePln = roundPricePln(amount * fx.rate);

  return {
    price: amount,
    priceCurrency: 'EUR' as OfferPriceCurrency,
    pricePln,
    exchangeRateUsed: fx.rate,
    exchangeRateDate: new Date(`${fx.date}T12:00:00.000Z`),
  };
}

/** Uzupełnia kurs EUR/PLN z NBP, gdy oferta nie ma zapisanego `exchangeRateUsed`. */
export async function enrichOfferMoneyFieldsForApi<T extends Record<string, unknown>>(offer: T) {
  const base = enrichOfferMoneyFields(offer);
  const amount = parsePriceAmount(base.price);
  if (amount <= 0) return base;

  let exchangeRateUsed = base.exchangeRateUsed as number | null;
  let exchangeRateDate = base.exchangeRateDate as string | null;

  if (exchangeRateUsed == null || exchangeRateUsed <= 0) {
    try {
      const fx = await getNbpEurPlnRate();
      exchangeRateUsed = fx.rate;
      exchangeRateDate = fx.date;
    } catch {
      exchangeRateUsed = DEFAULT_EUR_PLN_RATE;
      exchangeRateDate = exchangeRateDate ?? null;
    }
  }

  return {
    ...base,
    exchangeRateUsed,
    exchangeRateDate,
  };
}
