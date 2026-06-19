import type { Locale } from "@/i18n/config";
import type { ListingCurrency, DisplayCurrencyPreference } from "@/lib/money/types";
import { formatOfferSecondaryAmount } from "@/lib/money/format";

export function resolveRentAdminFeeAmount(offer: { adminFee?: unknown } | null | undefined): number | null {
  const amount = Number(offer?.adminFee);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount);
}

export function formatRentAdminFeeAmount(
  amount: number,
  locale: Locale = "pl",
  currency: ListingCurrency = "PLN",
): string {
  const tag = locale === "pl" ? "pl-PL" : locale === "uk" ? "uk-UA" : "en-GB";
  const formatted = amount.toLocaleString(tag);
  if (currency === "EUR") return `${formatted} €`;
  return locale === "en" || locale === "uk" ? `${formatted} PLN` : `${formatted} zł`;
}

export function formatRentAdminFeeCostsLabel(
  amount: number,
  locale: Locale = "pl",
  currency: ListingCurrency = "PLN",
  display?: { preference: DisplayCurrencyPreference; rate: number },
): string {
  const money = display
    ? formatOfferSecondaryAmount({
        amount,
        listingCurrency: currency,
        pricePln: currency === "PLN" ? amount : null,
        displayPreference: display.preference,
        rate: display.rate,
        locale: locale === "pl" ? "pl" : "en",
      })
    : formatRentAdminFeeAmount(amount, locale, currency);
  if (locale === "uk") return `${money} витрати`;
  return locale === "en" ? `${money} costs` : `${money} koszty`;
}
