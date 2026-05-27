"use client";

import { useCallback } from "react";
import { useDisplayCurrency } from "@/contexts/DisplayCurrencyContext";
import { useFxRate } from "@/contexts/FxRateContext";
import { useLocale } from "@/contexts/LocaleContext";
import {
  formatOfferPriceDisplay,
  formatMarkerPriceCompact,
  resolveOfferDisplayAmount,
  type FormattedOfferPrice,
} from "@/lib/money/format";
import { resolveOfferListingPrice } from "@/lib/money/resolveListingPrice";
import type { DisplayCurrencyPreference, ListingCurrency } from "@/lib/money/types";

export function useFormatOfferPrice() {
  const { preference } = useDisplayCurrency();
  const { rate, rateDate, source } = useFxRate();
  const { locale } = useLocale();
  const dateLocale = locale === "en" ? "en" : "pl";

  const formatOffer = useCallback(
    (offer: unknown, overridePref?: DisplayCurrencyPreference): FormattedOfferPrice => {
      const listing = resolveOfferListingPrice(offer, rate);
      return formatOfferPriceDisplay({
        amount: listing.amount,
        listingCurrency: listing.currency,
        pricePln: listing.plnAmount,
        displayPreference: overridePref ?? preference,
        rate,
        locale: dateLocale,
      });
    },
    [preference, rate, dateLocale],
  );

  const formatPinLabel = useCallback(
    (offer: unknown, isRent = false): string => {
      const listing = resolveOfferListingPrice(offer, rate);
      if (listing.amount <= 0) return "—";
      const disp = resolveOfferDisplayAmount({
        amount: listing.amount,
        listingCurrency: listing.currency,
        pricePln: listing.plnAmount,
        displayPreference: preference,
        rate,
      });
      const compact = formatMarkerPriceCompact(disp.displayAmount, disp.displayCurrency, dateLocale);
      return isRent ? `${compact} / mc` : compact;
    },
    [preference, rate, dateLocale],
  );

  const pricePerSqmLabel = useCallback(
    (offer: unknown): string | null => {
      const o = offer as Record<string, unknown> | null;
      if (!o) return null;
      const areaRaw = String(o.area ?? "")
        .replace(/,/g, ".")
        .replace(/[^\d.]/g, "");
      const area = parseFloat(areaRaw);
      const listing = resolveOfferListingPrice(offer, rate);
      if (listing.amount <= 0 || !Number.isFinite(area) || area <= 0) return null;
      const disp = resolveOfferDisplayAmount({
        amount: listing.amount,
        listingCurrency: listing.currency,
        pricePln: listing.plnAmount,
        displayPreference: preference,
        rate,
      });
      const perSqm = Math.round(disp.displayAmount / area);
      const suffix = disp.displayCurrency === "EUR" ? "€" : dateLocale === "en" ? "PLN" : "zł";
      return `${perSqm.toLocaleString(dateLocale === "pl" ? "pl-PL" : "en-GB")} ${suffix}/m²`;
    },
    [preference, rate, dateLocale],
  );

  return {
    preference,
    rate,
    rateDate,
    rateSource: source,
    formatOffer,
    formatPinLabel,
    pricePerSqmLabel,
  };
}

export type { FormattedOfferPrice, ListingCurrency, DisplayCurrencyPreference };
