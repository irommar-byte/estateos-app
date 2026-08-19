import type { RcnLocalFeature } from '@/lib/market/rcnParse';
import {
  QUALITY_MAX_AREA,
  QUALITY_MAX_PPSM,
  QUALITY_MAX_PRICE,
  QUALITY_MIN_AREA,
  QUALITY_MIN_PPSM,
  QUALITY_MIN_PRICE,
} from '@/lib/market/constants';

export function assessRcnQuality(row: RcnLocalFeature): { ok: boolean; flags: string[]; ppsm: number | null } {
  const flags: string[] = [];
  const residential = /mieszkal/i.test(row.functionCode || '');
  if (!residential) flags.push('non_residential');
  if (row.lat == null || row.lng == null) flags.push('missing_geom');
  if (row.areaM2 == null || row.areaM2 < QUALITY_MIN_AREA || row.areaM2 > QUALITY_MAX_AREA) flags.push('area');
  if (row.priceGross == null || row.priceGross < QUALITY_MIN_PRICE || row.priceGross > QUALITY_MAX_PRICE) {
    flags.push('price');
  }
  if (row.shareRatio < 0.99) flags.push('partial_share');
  if (!row.deedAt) flags.push('missing_date');

  let ppsm: number | null = null;
  if (row.priceGross && row.areaM2 && row.areaM2 > 0) {
    ppsm = row.priceGross / row.areaM2;
    if (ppsm < QUALITY_MIN_PPSM || ppsm > QUALITY_MAX_PPSM) flags.push('ppsm_outlier');
  } else {
    flags.push('no_ppsm');
  }

  const blocking = flags.some((f) =>
    ['non_residential', 'missing_geom', 'area', 'price', 'partial_share', 'ppsm_outlier', 'no_ppsm', 'missing_date'].includes(
      f,
    ),
  );
  return { ok: !blocking, flags, ppsm };
}
