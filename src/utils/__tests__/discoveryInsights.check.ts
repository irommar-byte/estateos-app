/**
 * Lightweight assertion suite for Discovery preference insights.
 * Run: npx tsx src/utils/__tests__/discoveryInsights.check.ts
 */
import {
  areaAffinityDelta,
  buildDiscoveryBuyerBrief,
  DISCOVERY_META,
  priceAffinityDelta,
  topStatEntries,
} from '../discoveryInsights';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const brief = buildDiscoveryBuyerBrief({
  likesCount: 12,
  dislikesCount: 4,
  fastTrackCount: 2,
  opensCount: 3,
  cityStats: { Warszawa: 5, Kraków: 2, Gdańsk: -1 },
  districtStats: { Mokotów: 3 },
  propertyStats: { FLAT: 6, HOUSE: 1 },
  reasonStats: {
    PRICE_TOO_HIGH: 2,
    [DISCOVERY_META.priceLikedSum]: 3_600_000,
    [DISCOVERY_META.priceLikedN]: 4,
    [DISCOVERY_META.areaLikedSum]: 240,
    [DISCOVERY_META.areaLikedN]: 4,
    [DISCOVERY_META.txSell]: 5,
    [DISCOVERY_META.txRent]: 1,
  },
});

assert(brief.topCities[0]?.key === 'Warszawa', 'top city should be Warszawa');
assert(brief.preferredBudgetPln === 900_000, `budget avg expected 900000 got ${brief.preferredBudgetPln}`);
assert(brief.preferredAreaM2 === 60, `area avg expected 60 got ${brief.preferredAreaM2}`);
assert(brief.preferredTransaction === 'SELL', 'transaction should prefer SELL');
assert(brief.summaryLine.includes('Warszawa'), 'summary should mention city');
assert(priceAffinityDelta(900_000, 900_000, null) >= 10, 'same price should boost');
assert(areaAffinityDelta(60, 60) >= 8, 'same area should boost');
assert(topStatEntries({ a: 3, __hidden: 9 }, 5).every((e) => e.key !== '__hidden'), 'meta keys excluded');

console.log('discoveryInsights.check.ts OK');
