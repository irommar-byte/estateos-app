import { getCityStats, getDistrictStats } from '@/lib/market/aggregates';
import { rcnLagNote, resolveRcnAsOfDate } from '@/lib/market/asOf';
import { WARSAW_CITY, RCN_SOURCE_LABEL } from '@/lib/market/constants';
import type { LearnedTaste } from '@/lib/crm/clientIntelligence';

const PERIOD_DAYS = 365;
const MIN_TXN = 15;

export type MarketRealitySnapshot = {
  city: string;
  districts: string[];
  area: number;
  maxPrice: number;
  impliedPpsm: number;
  medianPpsm: number | null;
  p25Ppsm: number | null;
  p75Ppsm: number | null;
  txnCount: number;
  periodDays: number;
  basis: 'district' | 'city';
  districtLabel: string;
  suggestedMaxPrice: number | null;
  rcnLagNote: string;
  source: string;
  asOfIso: string;
};

function phraseCount(taste: LearnedTaste, phrase: string): number {
  return taste.phrases.filter((item) => item === phrase).length;
}

function roundPrice(n: number): number {
  return Math.round(n / 10_000) * 10_000;
}

function parseDistrictList(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((item) => String(item).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((item) => String(item).trim()).filter(Boolean) : [];
    } catch {
      return raw.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

async function pickStats(city: string, districts: string[]) {
  const allDistrict = await getDistrictStats(city, PERIOD_DAYS);
  for (const d of districts) {
    const row = allDistrict.find((item) => item.district === d);
    if (row && row.txnCount >= MIN_TXN && row.p25Ppsm != null) {
      return { row, basis: 'district' as const, label: d };
    }
  }
  const cityRow = await getCityStats(city, PERIOD_DAYS);
  if (cityRow && cityRow.txnCount >= MIN_TXN && cityRow.p25Ppsm != null) {
    return { row: cityRow, basis: 'city' as const, label: city };
  }
  return null;
}

export async function buildBuyerMarketRealitySnapshot(params: {
  city: string | null | undefined;
  districts: unknown;
  maxPrice: number | null | undefined;
  minArea: number | null | undefined;
}): Promise<MarketRealitySnapshot | null> {
  const city = String(params.city || '').trim();
  if (!city || city.toLowerCase() !== WARSAW_CITY.toLowerCase()) return null;
  const maxPrice = Number(params.maxPrice);
  if (!Number.isFinite(maxPrice) || maxPrice <= 0) return null;
  const area = Math.max(40, Number(params.minArea) > 0 ? Number(params.minArea) : 40);
  const districts = parseDistrictList(params.districts);
  const picked = await pickStats(city, districts);
  if (!picked?.row.p25Ppsm || !picked.row.medianPpsm) return null;

  const impliedPpsm = maxPrice / area;
  const asOf = await resolveRcnAsOfDate(city);
  const lag = rcnLagNote(asOf, PERIOD_DAYS);
  const suggestedMaxPrice = roundPrice(picked.row.p25Ppsm * area);

  return {
    city,
    districts,
    area,
    maxPrice,
    impliedPpsm,
    medianPpsm: picked.row.medianPpsm,
    p25Ppsm: picked.row.p25Ppsm,
    p75Ppsm: picked.row.p75Ppsm,
    txnCount: picked.row.txnCount,
    periodDays: PERIOD_DAYS,
    basis: picked.basis,
    districtLabel: picked.label,
    suggestedMaxPrice: suggestedMaxPrice > maxPrice ? suggestedMaxPrice : null,
    rcnLagNote: lag,
    source: RCN_SOURCE_LABEL,
    asOfIso: asOf.toISOString(),
  };
}

export async function shouldTriggerMarketRealityCheckback(params: {
  city: string | null | undefined;
  districts: unknown;
  maxPrice: number | null | undefined;
  minArea: number | null | undefined;
  taste: LearnedTaste;
}): Promise<{ trigger: boolean; snapshot: MarketRealitySnapshot | null }> {
  if (phraseCount(params.taste, 'Za drogo') < 2) {
    return { trigger: false, snapshot: null };
  }
  const snapshot = await buildBuyerMarketRealitySnapshot(params);
  if (!snapshot || snapshot.p25Ppsm == null) {
    return { trigger: false, snapshot: null };
  }

  const impliedBelowP25 = snapshot.impliedPpsm < snapshot.p25Ppsm;
  const rejectedNearMedian =
    params.taste.expensivePrices.length > 0 &&
    snapshot.medianPpsm != null &&
    params.taste.expensivePrices.every((price) => price / snapshot.area <= snapshot.medianPpsm! * 1.05);

  return { trigger: impliedBelowP25 || rejectedNearMedian, snapshot };
}
