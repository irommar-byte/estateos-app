import { resolveOfferListingPrice } from '../money/offerPrice';

export type OfferPriceHistoryPoint = {
  id: number;
  offerId?: number;
  price: number;
  pricePln: number;
  priceCurrency?: string;
  recordedAt: string;
  changeType: string;
  source?: string | null;
};

export function buildChartSeriesFromHistory(rows: OfferPriceHistoryPoint[]): number[] {
  if (!rows.length) return [];
  return rows.map((row) => Number(row.pricePln));
}

export function buildFallbackPriceHistoryFromOffer(offer: unknown): OfferPriceHistoryPoint[] {
  if (!offer || typeof offer !== 'object') return [];
  const o = offer as Record<string, unknown>;
  const listing = resolveOfferListingPrice(o);
  const currentPln = Number(listing.plnAmount || listing.amount || 0);
  if (!Number.isFinite(currentPln) || currentPln <= 0) return [];

  const listRaw = Number(o.listPricePln ?? o.previousPrice ?? o.oldPrice ?? 0);
  const createdAt = String(o.createdAt || o.publishedAt || new Date().toISOString());
  const updatedAt = String(o.updatedAt || o.priceUpdatedAt || createdAt);

  if (Number.isFinite(listRaw) && listRaw > currentPln) {
    return [
      {
        id: -1,
        price: listRaw,
        pricePln: listRaw,
        priceCurrency: 'PLN',
        recordedAt: createdAt,
        changeType: 'INITIAL',
      },
      {
        id: -2,
        price: currentPln,
        pricePln: currentPln,
        priceCurrency: listing.currency || 'PLN',
        recordedAt: updatedAt,
        changeType: 'REDUCTION',
      },
    ];
  }

  if (currentPln > 0) {
    return [
      {
        id: -1,
        price: currentPln,
        pricePln: currentPln,
        priceCurrency: listing.currency || 'PLN',
        recordedAt: createdAt,
        changeType: 'INITIAL',
      },
    ];
  }

  return [];
}

export function normalizePriceHistoryRows(raw: unknown): OfferPriceHistoryPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const pricePln = Number(r.pricePln ?? r.price ?? 0);
      if (!Number.isFinite(pricePln) || pricePln <= 0) return null;
      return {
        id: Number(r.id ?? index + 1),
        offerId: r.offerId != null ? Number(r.offerId) : undefined,
        price: Number(r.price ?? pricePln),
        pricePln,
        priceCurrency: String(r.priceCurrency || 'PLN'),
        recordedAt: String(r.recordedAt || new Date().toISOString()),
        changeType: String(r.changeType || 'UPDATE'),
        source: r.source != null ? String(r.source) : null,
      } satisfies OfferPriceHistoryPoint;
    })
    .filter(Boolean) as OfferPriceHistoryPoint[];
}

export function computePriceHistoryDelta(series: number[]) {
  if (series.length < 2) {
    return { first: series[0] ?? 0, last: series[0] ?? 0, deltaPln: 0, deltaPercent: 0 };
  }
  const first = series[0];
  const last = series[series.length - 1];
  const deltaPln = last - first;
  const deltaPercent = first > 0 ? Math.round((deltaPln / first) * 100) : 0;
  return { first, last, deltaPln, deltaPercent };
}
