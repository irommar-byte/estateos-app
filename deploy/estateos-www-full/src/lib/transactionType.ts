export type TransactionMode = "sale" | "rent" | "other";

/** Zgodne z Prisma / mobile: SELL, RENT, sale, rent, … */
export function normalizeTransactionType(value: unknown): TransactionMode {
  const token = String(value ?? "")
    .trim()
    .toLowerCase();
  if (["sale", "sprzedaz", "sprzedaż", "sell"].includes(token)) return "sale";
  if (["rent", "wynajem", "lease"].includes(token)) return "rent";
  return "other";
}

export function transactionModeFromOffers(
  offers: { transactionType?: unknown }[],
): "sale" | "rent" {
  let sale = 0;
  let rent = 0;
  for (const o of offers) {
    const tx = normalizeTransactionType(o.transactionType);
    if (tx === "sale") sale += 1;
    else if (tx === "rent") rent += 1;
  }
  if (rent > 0 && sale === 0) return "rent";
  return "sale";
}
