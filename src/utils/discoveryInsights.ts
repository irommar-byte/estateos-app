/** Reserved numeric keys inside DiscoveryProfile.reasonStats for budget/metraż learning. */
export const DISCOVERY_META = {
  priceLikedSum: '__priceLikedSum',
  priceLikedN: '__priceLikedN',
  priceDislikedSum: '__priceDislikedSum',
  priceDislikedN: '__priceDislikedN',
  areaLikedSum: '__areaLikedSum',
  areaLikedN: '__areaLikedN',
  txSell: '__txSell',
  txRent: '__txRent',
} as const;

export type StatMap = Record<string, number>;

export function asStatMap(raw: unknown): StatMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: StatMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(value);
    if (!key || !Number.isFinite(n)) continue;
    out[key] = n;
  }
  return out;
}

export function isDiscoveryMetaKey(key: string): boolean {
  return key.startsWith('__');
}

export function topStatEntries(
  stats: unknown,
  limit = 5,
  opts?: { positiveOnly?: boolean; excludeMeta?: boolean },
): Array<{ key: string; value: number }> {
  const map = asStatMap(stats);
  const positiveOnly = opts?.positiveOnly !== false;
  const excludeMeta = opts?.excludeMeta !== false;
  return Object.entries(map)
    .filter(([key, value]) => {
      if (excludeMeta && isDiscoveryMetaKey(key)) return false;
      if (positiveOnly && value <= 0) return false;
      return Number.isFinite(value);
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, limit))
    .map(([key, value]) => ({ key, value }));
}

export function metaAvg(stats: StatMap, sumKey: string, nKey: string): number | null {
  const n = Number(stats[nKey] || 0);
  const sum = Number(stats[sumKey] || 0);
  if (!(n > 0) || !Number.isFinite(sum)) return null;
  return Math.round(sum / n);
}

export function bumpMeta(stats: StatMap, sumKey: string, nKey: string, amount: number) {
  if (!(amount > 0) || !Number.isFinite(amount)) return stats;
  stats[sumKey] = Number(stats[sumKey] || 0) + amount;
  stats[nKey] = Number(stats[nKey] || 0) + 1;
  return stats;
}

export function priceAffinityDelta(offerPrice: number, likedAvg: number | null, dislikedAvg: number | null): number {
  if (!(offerPrice > 0)) return 0;
  let delta = 0;
  if (likedAvg && likedAvg > 0) {
    const diff = Math.abs(offerPrice - likedAvg) / likedAvg;
    if (diff <= 0.18) delta += 14;
    else if (diff <= 0.35) delta += 6;
    else if (diff > 0.6) delta -= 10;
  }
  if (dislikedAvg && dislikedAvg > 0) {
    const diff = Math.abs(offerPrice - dislikedAvg) / dislikedAvg;
    if (diff <= 0.15) delta -= 12;
  }
  return delta;
}

export function areaAffinityDelta(offerArea: number, likedAvg: number | null): number {
  if (!(offerArea > 0) || !likedAvg || likedAvg <= 0) return 0;
  const diff = Math.abs(offerArea - likedAvg) / likedAvg;
  if (diff <= 0.2) return 10;
  if (diff <= 0.4) return 4;
  if (diff > 0.75) return -6;
  return 0;
}

export type DiscoveryBuyerBrief = {
  likesCount: number;
  dislikesCount: number;
  fastTrackCount: number;
  opensCount: number;
  topCities: Array<{ key: string; value: number }>;
  topDistricts: Array<{ key: string; value: number }>;
  topPropertyTypes: Array<{ key: string; value: number }>;
  dislikeReasons: Array<{ key: string; value: number }>;
  preferredBudgetPln: number | null;
  avoidedBudgetPln: number | null;
  preferredAreaM2: number | null;
  preferredTransaction: 'SELL' | 'RENT' | 'MIXED' | null;
  summaryLine: string;
};

export function buildDiscoveryBuyerBrief(input: {
  likesCount: number;
  dislikesCount: number;
  fastTrackCount: number;
  opensCount: number;
  cityStats: unknown;
  districtStats: unknown;
  propertyStats: unknown;
  reasonStats: unknown;
}): DiscoveryBuyerBrief {
  const reasonStats = asStatMap(input.reasonStats);
  const topCities = topStatEntries(input.cityStats, 5);
  const topDistricts = topStatEntries(input.districtStats, 5);
  const topPropertyTypes = topStatEntries(input.propertyStats, 5);
  const dislikeReasons = topStatEntries(reasonStats, 6);
  const preferredBudgetPln = metaAvg(reasonStats, DISCOVERY_META.priceLikedSum, DISCOVERY_META.priceLikedN);
  const avoidedBudgetPln = metaAvg(
    reasonStats,
    DISCOVERY_META.priceDislikedSum,
    DISCOVERY_META.priceDislikedN,
  );
  const preferredAreaM2 = metaAvg(reasonStats, DISCOVERY_META.areaLikedSum, DISCOVERY_META.areaLikedN);
  const sell = Number(reasonStats[DISCOVERY_META.txSell] || 0);
  const rent = Number(reasonStats[DISCOVERY_META.txRent] || 0);
  let preferredTransaction: DiscoveryBuyerBrief['preferredTransaction'] = null;
  if (sell > 0 || rent > 0) {
    if (sell > rent * 1.35) preferredTransaction = 'SELL';
    else if (rent > sell * 1.35) preferredTransaction = 'RENT';
    else preferredTransaction = 'MIXED';
  }

  const bits: string[] = [];
  if (topCities[0]) bits.push(`szuka w: ${topCities[0].key}`);
  if (topPropertyTypes[0]) bits.push(`typ: ${topPropertyTypes[0].key}`);
  if (preferredBudgetPln) bits.push(`budżet ~${preferredBudgetPln.toLocaleString('pl-PL')} PLN`);
  if (preferredAreaM2) bits.push(`~${preferredAreaM2} m²`);
  if (preferredTransaction === 'SELL') bits.push('transakcja: sprzedaż');
  if (preferredTransaction === 'RENT') bits.push('transakcja: wynajem');

  return {
    likesCount: input.likesCount,
    dislikesCount: input.dislikesCount,
    fastTrackCount: input.fastTrackCount,
    opensCount: input.opensCount,
    topCities,
    topDistricts,
    topPropertyTypes,
    dislikeReasons,
    preferredBudgetPln,
    avoidedBudgetPln,
    preferredAreaM2,
    preferredTransaction,
    summaryLine: bits.length ? bits.join(' · ') : 'Za mało swipe’ów do pełnego profilu',
  };
}
