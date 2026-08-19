import { prisma } from '@/lib/prisma';
import { MARKET_KIND_LOCAL, WARSAW_CITY } from '@/lib/market/constants';
import { WARSAW_DISTRICT_CENTROIDS } from '@/lib/market/warsawDistricts';
import { rcnLagNote, resolveRcnAsOfDate, windowStart } from '@/lib/market/asOf';
import type { MarketAreaStatView, MarketIntelligencePayload } from '@/lib/market/types';

const PERIODS = [30, 90, 180, 365, 730];

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

function mean(values: number[]) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

async function ppsmFor(city: string, district: string | null, since: Date, until?: Date) {
  const rows = await prisma.marketTransaction.findMany({
    where: {
      city,
      kind: MARKET_KIND_LOCAL,
      qualityOk: true,
      ...(district ? { district } : {}),
      deedAt: until ? { gte: since, lte: until } : { gte: since },
      pricePerM2: { not: null },
    },
    select: { pricePerM2: true },
  });
  return rows.map((r) => r.pricePerM2!).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
}

export async function recomputeWarsawAreaStats() {
  const city = WARSAW_CITY;
  const districts = ['', ...Object.keys(WARSAW_DISTRICT_CENTROIDS)];
  const now = new Date();
  const asOf = await resolveRcnAsOfDate(city);

  for (const periodDays of PERIODS) {
    const since = windowStart(asOf, periodDays);
    const prevSince = windowStart(since, periodDays);
    for (const district of districts) {
      const values = await ppsmFor(city, district || null, since, asOf);
      const prev = await ppsmFor(city, district || null, prevSince, since);
      const median = percentile(values, 0.5);
      const prevMedian = percentile(prev, 0.5);
      const yoy =
        median != null && prevMedian != null && prevMedian > 0
          ? ((median - prevMedian) / prevMedian) * 100
          : null;
      await prisma.marketAreaStat.upsert({
        where: {
          city_district_periodDays_kind_marketType: {
            city,
            district,
            periodDays,
            kind: MARKET_KIND_LOCAL,
            marketType: 'all',
          },
        },
        create: {
          city,
          district,
          periodDays,
          kind: MARKET_KIND_LOCAL,
          marketType: 'all',
          txnCount: values.length,
          avgPpsm: mean(values),
          medianPpsm: median,
          p25Ppsm: percentile(values, 0.25),
          p75Ppsm: percentile(values, 0.75),
          yoyChangePct: yoy,
          computedAt: now,
        },
        update: {
          txnCount: values.length,
          avgPpsm: mean(values),
          medianPpsm: median,
          p25Ppsm: percentile(values, 0.25),
          p75Ppsm: percentile(values, 0.75),
          yoyChangePct: yoy,
          computedAt: now,
        },
      });
    }
  }
}

export async function getCityStats(city: string, periodDays: number): Promise<MarketAreaStatView | null> {
  const row = await prisma.marketAreaStat.findFirst({
    where: { city, district: '', periodDays, kind: MARKET_KIND_LOCAL, marketType: 'all' },
  });
  if (!row) return null;
  return {
    city: row.city,
    district: row.district,
    periodDays: row.periodDays,
    txnCount: row.txnCount,
    avgPpsm: row.avgPpsm,
    medianPpsm: row.medianPpsm,
    p25Ppsm: row.p25Ppsm,
    p75Ppsm: row.p75Ppsm,
    yoyChangePct: row.yoyChangePct,
  };
}

export async function getDistrictStats(city: string, periodDays: number): Promise<MarketAreaStatView[]> {
  const rows = await prisma.marketAreaStat.findMany({
    where: {
      city,
      periodDays,
      kind: MARKET_KIND_LOCAL,
      marketType: 'all',
      NOT: { district: '' },
    },
    orderBy: { medianPpsm: 'desc' },
  });
  return rows.map((row) => ({
    city: row.city,
    district: row.district,
    periodDays: row.periodDays,
    txnCount: row.txnCount,
    avgPpsm: row.avgPpsm,
    medianPpsm: row.medianPpsm,
    p25Ppsm: row.p25Ppsm,
    p75Ppsm: row.p75Ppsm,
    yoyChangePct: row.yoyChangePct,
  }));
}

export async function buildMarketIntelligence(city = WARSAW_CITY, periodDays = 365): Promise<MarketIntelligencePayload> {
  const asOf = await resolveRcnAsOfDate(city);
  const cityStat = await getCityStats(city, periodDays);
  const districts = await getDistrictStats(city, periodDays);
  const yoy = cityStat?.yoyChangePct ?? null;
  const headline =
    yoy == null
      ? 'Za mało historii, żeby ogłosić trend'
      : yoy >= 1.5
        ? 'Rynek rośnie'
        : yoy <= -1.5
          ? 'Rynek hamuje'
          : 'Rynek stabilny';

  const fastestGrowing = [...districts]
    .filter((d) => d.yoyChangePct != null && d.txnCount >= 20)
    .sort((a, b) => (b.yoyChangePct || 0) - (a.yoyChangePct || 0))
    .slice(0, 3)
    .map((d) => ({
      district: d.district,
      yoyChangePct: Number((d.yoyChangePct || 0).toFixed(1)),
      medianPpsm: Math.round(d.medianPpsm || 0),
    }));

  const mostExpensive = [...districts]
    .filter((d) => d.medianPpsm && d.txnCount >= 15)
    .sort((a, b) => (b.medianPpsm || 0) - (a.medianPpsm || 0))
    .slice(0, 3)
    .map((d) => ({
      district: d.district,
      medianPpsm: Math.round(d.medianPpsm || 0),
      txnCount: d.txnCount,
    }));

  const mostDeals = [...districts]
    .sort((a, b) => b.txnCount - a.txnCount)
    .slice(0, 3)
    .map((d) => ({
      district: d.district,
      txnCount: d.txnCount,
      medianPpsm: Math.round(d.medianPpsm || 0),
    }));

  return {
    city,
    periodDays,
    headline,
    yoyChangePct: yoy != null ? Number(yoy.toFixed(1)) : null,
    medianPpsm: cityStat?.medianPpsm != null ? Math.round(cityStat.medianPpsm) : null,
    txnCount: cityStat?.txnCount || 0,
    fastestGrowing,
    mostExpensive,
    mostDeals,
    updatedAt: cityStat ? new Date().toISOString() : null,
    asOf: asOf.toISOString(),
    lagNote: rcnLagNote(asOf, periodDays),
  };
}
