/** Client-safe helpers for offer price history — no Prisma / server imports. */

export type OfferPriceHistoryRow = {
  id: number;
  offerId: number;
  price: number;
  pricePln: number;
  priceCurrency: string;
  recordedAt: Date;
  changeType: string;
  source: string | null;
};

export function computePriceDiscountPercent(listPricePln: number, currentPricePln: number): number | null {
  if (!Number.isFinite(listPricePln) || !Number.isFinite(currentPricePln)) return null;
  if (listPricePln <= 0 || currentPricePln <= 0 || currentPricePln >= listPricePln) return null;
  return Math.round((1 - currentPricePln / listPricePln) * 100);
}

/** Chart series from real history (PLN amounts). */
export function buildChartSeriesFromHistory(rows: OfferPriceHistoryRow[]): number[] {
  if (!rows.length) return [];
  return rows.map((r) => Number(r.pricePln));
}
