/**
 * Rodzaje transakcji z Rejestru Cen Nieruchomości, które liczymy osobno:
 * mieszkania (lokale), domy (budynki mieszkalne) i działki — każdy ma inną cenę za m²
 * (dom: za m² użytkowy, działka: za m² gruntu), więc nigdy ich nie mieszamy.
 */
export const MARKET_KIND_LOCAL = 'LOCAL';
export const MARKET_KIND_BUILDING = 'BUILDING';
export const MARKET_KIND_PLOT = 'PLOT';

export type MarketKind = typeof MARKET_KIND_LOCAL | typeof MARKET_KIND_BUILDING | typeof MARKET_KIND_PLOT;

export const MARKET_KINDS: MarketKind[] = [MARKET_KIND_LOCAL, MARKET_KIND_BUILDING, MARKET_KIND_PLOT];

export type KindQuality = {
  minArea: number;
  maxArea: number;
  minPrice: number;
  maxPrice: number;
  minPpsm: number;
  maxPpsm: number;
  /** Tolerancja metrażu przy porównywalnych transakcjach. */
  areaTolerance: number;
};

export const KIND_QUALITY: Record<MarketKind, KindQuality> = {
  LOCAL: { minArea: 15, maxArea: 250, minPrice: 80_000, maxPrice: 12_000_000, minPpsm: 4_000, maxPpsm: 55_000, areaTolerance: 0.15 },
  BUILDING: { minArea: 40, maxArea: 1_000, minPrice: 250_000, maxPrice: 40_000_000, minPpsm: 2_000, maxPpsm: 45_000, areaTolerance: 0.3 },
  PLOT: { minArea: 150, maxArea: 60_000, minPrice: 20_000, maxPrice: 60_000_000, minPpsm: 40, maxPpsm: 12_000, areaTolerance: 0.5 },
};

export const KIND_LABEL: Record<MarketKind, { one: string; many: string; unit: string }> = {
  LOCAL: { one: 'mieszkanie', many: 'mieszkania', unit: 'zł/m² powierzchni użytkowej' },
  BUILDING: { one: 'dom', many: 'domy', unit: 'zł/m² powierzchni użytkowej domu' },
  PLOT: { one: 'działka', many: 'działki', unit: 'zł/m² gruntu' },
};

export function parseMarketKind(raw: unknown): MarketKind {
  const s = String(raw || '').trim().toUpperCase();
  if (s === MARKET_KIND_BUILDING || s === 'HOUSE' || s.includes('DOM')) return MARKET_KIND_BUILDING;
  if (s === MARKET_KIND_PLOT || s.includes('PLOT') || s.includes('DZIA') || s.includes('LAND')) return MARKET_KIND_PLOT;
  return MARKET_KIND_LOCAL;
}

/** Typ oferty → rodzaj transakcji RCN. Lokal użytkowy nie ma jeszcze danych (null). */
export function marketKindForPropertyType(propertyType: unknown): MarketKind | null {
  const t = String(propertyType || '').trim().toUpperCase();
  if (!t || t.includes('FLAT') || t.includes('APART') || t.includes('MIESZKAN')) return MARKET_KIND_LOCAL;
  if (t.includes('HOUSE') || t.includes('DOM')) return MARKET_KIND_BUILDING;
  if (t.includes('PLOT') || t.includes('DZIA') || t.includes('LAND')) return MARKET_KIND_PLOT;
  return null;
}
