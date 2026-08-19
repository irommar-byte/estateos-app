import { parseLooseNumber } from '@/lib/market/format';
import { WARSAW_CITY } from '@/lib/market/constants';
import type { MarketTypeFilter, ValuationPurpose, ValuationSubject } from '@/lib/market/types';

export function parseValuationSubject(body: Record<string, unknown>): ValuationSubject | { error: string } {
  const lat = parseLooseNumber(body.lat);
  const lng = parseLooseNumber(body.lng);
  const area = parseLooseNumber(body.area);
  if (lat == null || lng == null) return { error: 'Brak współrzędnych nieruchomości.' };
  if (area == null || area < 10) return { error: 'Podaj powierzchnię użytkową (min. 10 m²).' };
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
  };
}

export function parsePurpose(raw: unknown): ValuationPurpose {
  const s = String(raw || 'crm').toLowerCase();
  if (s === 'listing' || s === 'consumer' || s === 'hub' || s === 'crm') return s;
  return 'crm';
}
