import type { RcnLocalFeature } from '@/lib/market/rcnParse';
import { KIND_QUALITY, MARKET_KIND_LOCAL, type MarketKind } from '@/lib/market/marketKinds';

const BLOCKING = ['non_residential', 'missing_geom', 'area', 'price', 'partial_share', 'ppsm_outlier', 'no_ppsm', 'missing_date', 'mixed_price'];

/** Czy akt nadaje się do statystyk danego rodzaju (mieszkania / domy / działki). */
export function assessRcnQuality(
  row: RcnLocalFeature & { priceScope?: 'unit' | 'property' },
  kind: MarketKind = MARKET_KIND_LOCAL,
): { ok: boolean; flags: string[]; ppsm: number | null } {
  const q = KIND_QUALITY[kind];
  const flags: string[] = [];
  if (kind !== 'PLOT' && !/mieszkal/i.test(row.functionCode || '')) flags.push('non_residential');
  // Cena całej nieruchomości przy działce zabudowanej zawyża zł/m² gruntu — taki akt pomijamy.
  if (kind === 'PLOT' && row.priceScope === 'property' && /zabud/i.test(`${row.functionCode} ${row.transactionKind}`) && !/niezabud/i.test(`${row.functionCode} ${row.transactionKind}`)) {
    flags.push('mixed_price');
  }
  if (row.lat == null || row.lng == null) flags.push('missing_geom');
  if (row.areaM2 == null || row.areaM2 < q.minArea || row.areaM2 > q.maxArea) flags.push('area');
  if (row.priceGross == null || row.priceGross < q.minPrice || row.priceGross > q.maxPrice) flags.push('price');
  if (row.shareRatio < 0.99) flags.push('partial_share');
  if (!row.deedAt) flags.push('missing_date');

  let ppsm: number | null = null;
  if (row.priceGross && row.areaM2 && row.areaM2 > 0) {
    ppsm = row.priceGross / row.areaM2;
    if (ppsm < q.minPpsm || ppsm > q.maxPpsm) flags.push('ppsm_outlier');
  } else {
    flags.push('no_ppsm');
  }
  return { ok: !flags.some((f) => BLOCKING.includes(f)), flags, ppsm };
}
