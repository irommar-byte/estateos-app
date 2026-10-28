import { parseLooseNumber } from '@/lib/market/format';
import { WARSAW_CITY } from '@/lib/market/constants';
import { KIND_QUALITY, marketKindForPropertyType, parseMarketKind } from '@/lib/market/marketKinds';
import type { MarketTypeFilter, ValuationPurpose, ValuationSubject } from '@/lib/market/types';

export function parseValuationSubject(body: Record<string, unknown>): ValuationSubject | { error: string } {
  const lat = parseLooseNumber(body.lat);
  const lng = parseLooseNumber(body.lng);
  const area = parseLooseNumber(body.area);
  if (lat == null || lng == null) return { error: 'Brak współrzędnych nieruchomości.' };
  const kind = body.kind ? parseMarketKind(body.kind) : body.propertyType ? marketKindForPropertyType(body.propertyType) : 'LOCAL';
  if (!kind) return { error: 'Dla lokali użytkowych nie mamy jeszcze porównania z aktami RCN.' };
  if (area == null || area < Math.min(10, KIND_QUALITY[kind].minArea)) {
    return { error: kind === 'PLOT' ? 'Podaj powierzchnię działki.' : 'Podaj powierzchnię użytkową (min. 10 m²).' };
  }
  const city = String(body.city || WARSAW_CITY).trim() || WARSAW_CITY;
  const marketRaw = String(body.marketType || 'all').toLowerCase();
  const marketType: MarketTypeFilter =
    marketRaw.includes('pierw') ? 'pierwotny' : marketRaw.includes('wtor') || marketRaw.includes('wtór') ? 'wtorny' : 'all';
  return {
    city,
    district: body.district ? String(body.district) : null,
    address: body.address ? String(body.address) : null,
    lat,
    lng,
    area,
    rooms: parseLooseNumber(body.rooms),
    floor: parseLooseNumber(body.floor),
    marketType,
    kind,
  };
}

export function parsePurpose(raw: unknown): ValuationPurpose {
  const s = String(raw || 'crm').toLowerCase();
  if (s === 'listing' || s === 'consumer' || s === 'hub' || s === 'crm' || s === 'status') return s;
  return 'crm';
}

/** Map RCN vs-median % to the same ±5% banners used in the mobile UI. */
export function marketStatusFromVsMedianPct(vsMedianPct: number): 'bargain' | 'market' | 'luxury' {
  if (vsMedianPct <= -5) return 'bargain';
  if (vsMedianPct >= 5) return 'luxury';
  return 'market';
}
