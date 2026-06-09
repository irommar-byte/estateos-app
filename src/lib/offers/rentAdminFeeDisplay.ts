import type { Locale } from "@/i18n/config";

export function resolveRentAdminFeeAmount(offer: { adminFee?: unknown } | null | undefined): number | null {
  const amount = Number(offer?.adminFee);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount);
}

export function formatRentAdminFeeAmount(
  amount: number,
  locale: Locale = "pl",
): string {
  const tag = locale === "pl" ? "pl-PL" : locale === "uk" ? "uk-UA" : "en-GB";
  const formatted = amount.toLocaleString(tag);
  return locale === "en" || locale === "uk" ? `${formatted} PLN` : `${formatted} zł`;
}

export function formatRentAdminFeeCostsLabel(
  amount: number,
  locale: Locale = "pl",
): string {
  const money = formatRentAdminFeeAmount(amount, locale);
  if (locale === "uk") return `${money} витрати`;
  return locale === "en" ? `${money} costs` : `${money} koszty`;
}
