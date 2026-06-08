export function resolveRentAdminFeeAmount(offer: { adminFee?: unknown } | null | undefined): number | null {
  const amount = Number(offer?.adminFee);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount);
}

export function formatRentAdminFeeAmount(
  amount: number,
  locale: "pl" | "en" = "pl",
): string {
  const formatted = amount.toLocaleString(locale === "pl" ? "pl-PL" : "en-GB");
  return locale === "en" ? `${formatted} PLN` : `${formatted} zł`;
}

export function formatRentAdminFeeCostsLabel(
  amount: number,
  locale: "pl" | "en" = "pl",
): string {
  const money = formatRentAdminFeeAmount(amount, locale);
  return locale === "en" ? `${money} costs` : `${money} koszty`;
}
