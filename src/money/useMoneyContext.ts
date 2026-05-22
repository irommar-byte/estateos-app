import { useCallback } from 'react';
import { formatOfferPriceDisplay, type FormattedOfferPrice } from './format';
import { resolveOfferListingPrice } from './offerPrice';
import { useDisplayCurrencyStore } from '../store/useDisplayCurrencyStore';
import { useFxRateStore } from '../store/useFxRateStore';
import type { DisplayCurrencyPreference } from './types';

export function useMoneyContext() {
  const preference = useDisplayCurrencyStore((s) => s.preference);
  const hydrated = useDisplayCurrencyStore((s) => s.hydrated);
  const rate = useFxRateStore((s) => s.rate);
  const rateDate = useFxRateStore((s) => s.rateDate);

  const formatOffer = useCallback(
    (offer: unknown, overridePref?: DisplayCurrencyPreference): FormattedOfferPrice => {
      const listing = resolveOfferListingPrice(offer, rate);
      return formatOfferPriceDisplay({
        amount: listing.amount,
        listingCurrency: listing.currency,
        pricePln: listing.plnAmount,
        displayPreference: overridePref ?? preference,
        rate,
        rateDate,
      });
    },
    [preference, rate, rateDate],
  );

  return { preference, rate, rateDate, formatOffer, hydrated };
}
