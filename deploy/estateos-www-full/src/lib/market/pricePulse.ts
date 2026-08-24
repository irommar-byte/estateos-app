import { prisma } from '@/lib/prisma';
import { canonicalizeCity } from '@/lib/location/locationCatalog';
import {
  MARKET_KIND_LOCAL,
  QUALITY_MAX_PPSM,
  QUALITY_MIN_AREA,
  QUALITY_MIN_PPSM,
  QUALITY_MIN_PRICE,
  RCN_ATTRIBUTION,
  RCN_SOURCE_LABEL,
  WARSAW_CITY,
} from '@/lib/market/constants';
import { ensureMarketTables } from '@/lib/market/ensureMarketTables';
import type {
  PricePulseDirection,
  PricePulseDistrict,
  PricePulsePayload,
  PricePulsePoint,
  PricePulseTone,
  PricePulseTrend,
  PricePulseWindow,
} from '@/lib/market/types';
import { resolveWarsawDistrict } from '@/lib/market/warsawDistricts';

const CACHE_MS = 60_000;
const LOOKBACK_DAYS = 180;
const TREND_LOOKBACK_DAYS = 800;
const SERIES_DAYS = 90;
const ROLLING_DAYS = 7;
const MIN_WINDOW_LISTINGS = 4;
const MIN_WINDOW_DEEDS = 8;
const MIN_DISTRICT_LISTINGS = 4;
const SHARE_TITLE = /udzia[łl]/i;

const cache: { at: number; payload: PricePulsePayload | null } = { at: 0, payload: null };

function dayKey(value: Date): string {
  return value.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
}

function addDays(isoDay: string, days: number): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function enumerateDays(endDay: string, count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) out.push(addDays(endDay, -i));
  return out;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pctChange(now: number | null, prev: number | null): number | null {
  if (now == null || prev == null || prev <= 0) return null;
  return ((now - prev) / prev) * 100;
}

function vsPct(listing: number | null, deed: number | null): number | null {
  if (listing == null || deed == null || deed <= 0) return null;
  return ((listing - deed) / deed) * 100;
}

function roundOrNull(value: number | null, digits = 1): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function toneOf(changePct: number | null): PricePulseTone {
  if (changePct == null) return 'flat';
  if (changePct >= 0.4) return 'up';
  if (changePct <= -0.4) return 'down';
  return 'flat';
}

function directionOf(listingChangePct: number | null): PricePulseDirection {
  if (listingChangePct == null) return 'stable';
  if (listingChangePct >= 1) return 'rising';
  if (listingChangePct <= -1) return 'falling';
  return 'stable';
}

function pushPpsm(map: Map<string, number[]>, key: string, ppsm: number) {
  const list = map.get(key);
  if (list) list.push(ppsm);
  else map.set(key, [ppsm]);
}

function collect(map: Map<string, number[]>, days: string[]): number[] {
  const out: number[] = [];
  for (const day of days) {
    const values = map.get(day);
    if (values) out.push(...values);
  }
  return out;
}

function rollingMedian(map: Map<string, number[]>, days: string[], index: number, window: number) {
  const slice = days.slice(Math.max(0, index - window + 1), index + 1);
  return median(collect(map, slice));
}

function isoWeekKey(isoDay: string): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function bucketSeries(
  byDay: Map<string, number[]>,
  days: string[],
  bucketOf: (day: string) => string,
  take: number,
  minSamples: number,
): { key: string; ppsm: number | null; count: number }[] {
  const buckets = new Map<string, number[]>();
  const order: string[] = [];
  for (const day of days) {
    const key = bucketOf(day);
    const values = byDay.get(day);
    if (!values?.length) continue;
    let list = buckets.get(key);
    if (!list) {
      list = [];
      buckets.set(key, list);
      order.push(key);
    }
    list.push(...values);
  }
  const sliced = order.slice(-take);
  return sliced.map((key) => {
    const values = buckets.get(key) || [];
    const ppsm = values.length >= minSamples ? median(values) : null;
    return { key, ppsm: ppsm != null ? Math.round(ppsm) : null, count: values.length };
  });
}

function windowDeedChange(byDay: Map<string, number[]>, days: string[], size: number, minSamples: number) {
  const currentDays = days.slice(-size);
  const previousDays = days.slice(Math.max(0, days.length - size * 2), days.length - size);
  const current = collect(byDay, currentDays);
  const previous = collect(byDay, previousDays);
  const nowMed = current.length >= minSamples ? median(current) : null;
  const prevMed = previous.length >= minSamples ? median(previous) : null;
  return {
    changePct: roundOrNull(pctChange(nowMed, prevMed)),
    currentPpsm: nowMed != null ? Math.round(nowMed) : null,
    previousPpsm: prevMed != null ? Math.round(prevMed) : null,
    count: current.length,
  };
}

function buildTrend(
  key: PricePulseTrend['key'],
  byDay: Map<string, number[]>,
  days: string[],
  bucketOf: (day: string) => string,
  take: number,
  minSamples: number,
  windowDays: number,
): PricePulseTrend {
  const points = bucketSeries(byDay, days, bucketOf, take, minSamples).map((row) => ({
    key: row.key,
    ppsm: row.ppsm,
  }));
  const windowed = windowDeedChange(byDay, days, windowDays, minSamples);
  let changePct = windowed.changePct;
  if (changePct == null) {
    const numbered = points.filter((p) => p.ppsm != null);
    if (numbered.length >= 2) {
      changePct = roundOrNull(pctChange(numbered[numbered.length - 1].ppsm, numbered[0].ppsm));
    }
  }
  return {
    key,
    changePct,
    currentPpsm: windowed.currentPpsm ?? points[points.length - 1]?.ppsm ?? null,
    previousPpsm: windowed.previousPpsm,
    count: windowed.count,
    points,
  };
}

function windowStats(
  listings: Map<string, number[]>,
  deeds: Map<string, number[]>,
  days: string[],
  size: number,
): PricePulseWindow {
  const currentDays = days.slice(-size);
  const previousDays = days.slice(Math.max(0, days.length - size * 2), days.length - size);
  const listingValues = collect(listings, currentDays);
  const prevListingValues = collect(listings, previousDays);
  const deedValues = collect(deeds, currentDays);
  const prevDeedValues = collect(deeds, previousDays);
  const listingPpsm = listingValues.length >= MIN_WINDOW_LISTINGS ? median(listingValues) : null;
  const prevListing = prevListingValues.length >= MIN_WINDOW_LISTINGS ? median(prevListingValues) : null;
  const deedPpsm = deedValues.length >= MIN_WINDOW_DEEDS ? median(deedValues) : null;
  const prevDeed = prevDeedValues.length >= MIN_WINDOW_DEEDS ? median(prevDeedValues) : null;
  return {
    days: size,
    listingPpsm: listingPpsm != null ? Math.round(listingPpsm) : null,
    deedPpsm: deedPpsm != null ? Math.round(deedPpsm) : null,
    vsDeedsPct: roundOrNull(vsPct(listingPpsm, deedPpsm)),
    listingChangePct: roundOrNull(pctChange(listingPpsm, prevListing)),
    deedChangePct: roundOrNull(pctChange(deedPpsm, prevDeed)),
    listingCount: listingValues.length,
    deedCount: deedValues.length,
  };
}

export async function buildPricePulse(): Promise<PricePulsePayload> {
  const now = Date.now();
  if (cache.payload && now - cache.at < CACHE_MS) return cache.payload;

  await ensureMarketTables();

  const today = dayKey(new Date());
  const seriesDays = enumerateDays(today, SERIES_DAYS);
  const lookbackDays = enumerateDays(today, LOOKBACK_DAYS);
  const trendDays = enumerateDays(today, TREND_LOOKBACK_DAYS);
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000);

  const [txns, offers, areaStats, trendTxns] = await Promise.all([
    prisma.marketTransaction.findMany({
      where: {
        city: WARSAW_CITY,
        kind: MARKET_KIND_LOCAL,
        qualityOk: true,
        deedAt: { gte: since },
        pricePerM2: { not: null },
      },
      select: { deedAt: true, pricePerM2: true, district: true },
    }),
    prisma.offer.findMany({
      where: {
        transactionType: 'SELL',
        propertyType: 'FLAT',
        status: { in: ['ACTIVE', 'SOLD', 'ARCHIVED', 'IN_DEAL'] },
        createdAt: { gte: since },
        area: { gte: QUALITY_MIN_AREA },
      },
      select: {
        title: true,
        price: true,
        pricePln: true,
        area: true,
        city: true,
        district: true,
        street: true,
        lat: true,
        lng: true,
        createdAt: true,
      },
    }),
    prisma.marketAreaStat.findMany({
      where: {
        city: WARSAW_CITY,
        periodDays: 365,
        kind: MARKET_KIND_LOCAL,
        marketType: 'all',
        medianPpsm: { not: null },
      },
      select: { district: true, medianPpsm: true },
    }),
    prisma.marketTransaction.findMany({
      where: {
        city: WARSAW_CITY,
        kind: MARKET_KIND_LOCAL,
        qualityOk: true,
        deedAt: { gte: new Date(Date.now() - TREND_LOOKBACK_DAYS * 86400000) },
        pricePerM2: { not: null },
      },
      select: { deedAt: true, pricePerM2: true },
    }),
  ]);

  const listingsByDay = new Map<string, number[]>();
  const deedsByDay = new Map<string, number[]>();
  const listingsByDistrict = new Map<string, number[]>();

  for (const row of txns) {
    if (!row.deedAt || row.pricePerM2 == null) continue;
    const ppsm = Number(row.pricePerM2);
    if (!Number.isFinite(ppsm) || ppsm < QUALITY_MIN_PPSM || ppsm > QUALITY_MAX_PPSM) continue;
    pushPpsm(deedsByDay, dayKey(row.deedAt), ppsm);
  }

  for (const offer of offers) {
    if (SHARE_TITLE.test(String(offer.title || ''))) continue;
    if (canonicalizeCity(offer.city) !== WARSAW_CITY) continue;
    const area = Number(offer.area);
    const price = Number(offer.pricePln ?? offer.price ?? 0);
    if (!Number.isFinite(area) || area < QUALITY_MIN_AREA || !Number.isFinite(price) || price < QUALITY_MIN_PRICE) {
      continue;
    }
    const ppsm = price / area;
    if (ppsm < QUALITY_MIN_PPSM || ppsm > QUALITY_MAX_PPSM) continue;
    pushPpsm(listingsByDay, dayKey(offer.createdAt), ppsm);
    const district =
      resolveWarsawDistrict({ street: offer.street, lat: offer.lat, lng: offer.lng }) ||
      (offer.district && offer.district !== 'OTHER' ? offer.district : null);
    if (district) pushPpsm(listingsByDistrict, district, ppsm);
  }

  const trendByDay = new Map<string, number[]>();
  for (const row of trendTxns) {
    if (!row.deedAt || row.pricePerM2 == null) continue;
    const ppsm = Number(row.pricePerM2);
    if (!Number.isFinite(ppsm) || ppsm < QUALITY_MIN_PPSM || ppsm > QUALITY_MAX_PPSM) continue;
    pushPpsm(trendByDay, dayKey(row.deedAt), ppsm);
  }

  const trends = {
    day: buildTrend('day', trendByDay, trendDays, (day) => day, 21, 2, 1),
    week: buildTrend('week', trendByDay, trendDays, isoWeekKey, 12, 4, 7),
    month: buildTrend('month', trendByDay, trendDays, (day) => day.slice(0, 7), 12, 8, 30),
    year: buildTrend('year', trendByDay, trendDays, (day) => day.slice(0, 7), 24, 8, 365),
  };

  const series: PricePulsePoint[] = seriesDays.map((date, index) => {
    const listingPpsm = rollingMedian(listingsByDay, seriesDays, index, ROLLING_DAYS);
    const deedPpsm = rollingMedian(deedsByDay, seriesDays, index, ROLLING_DAYS);
    return {
      date,
      listingPpsm: listingPpsm != null ? Math.round(listingPpsm) : null,
      deedPpsm: deedPpsm != null ? Math.round(deedPpsm) : null,
      vsDeedsPct: roundOrNull(vsPct(listingPpsm, deedPpsm)),
    };
  });

  const d7 = windowStats(listingsByDay, deedsByDay, lookbackDays, 7);
  const d30 = windowStats(listingsByDay, deedsByDay, lookbackDays, 30);
  const d90 = windowStats(listingsByDay, deedsByDay, lookbackDays, 90);

  const seriesChange = (days: number): number | null => {
    const slice = series.filter((point) => point.listingPpsm != null).slice(-Math.max(days, 2));
    if (slice.length < 2) return null;
    const first = slice[0].listingPpsm;
    const last = slice[slice.length - 1].listingPpsm;
    return roundOrNull(pctChange(last, first));
  };
  if (d7.listingChangePct == null) d7.listingChangePct = seriesChange(7);
  if (d30.listingChangePct == null) d30.listingChangePct = seriesChange(30);
  if (d90.listingChangePct == null) d90.listingChangePct = seriesChange(90);

  const vsDeedsPct = d30.vsDeedsPct ?? d7.vsDeedsPct;
  const listingPpsm = d30.listingPpsm ?? d7.listingPpsm;
  const deedPpsm = d30.deedPpsm ?? d7.deedPpsm;
  const deedTrendPct = trends.month.changePct ?? trends.week.changePct ?? d30.deedChangePct;
  const tone = toneOf(deedTrendPct ?? d30.listingChangePct ?? d7.listingChangePct);
  const direction = directionOf(deedTrendPct ?? d30.listingChangePct ?? d7.listingChangePct);

  const deedByDistrict = new Map<string, number>();
  let cityDeed: number | null = null;
  for (const row of areaStats) {
    if (row.medianPpsm == null) continue;
    if (!row.district) cityDeed = row.medianPpsm;
    else deedByDistrict.set(row.district, row.medianPpsm);
  }

  const districts: PricePulseDistrict[] = [];
  for (const [district, values] of listingsByDistrict) {
    if (values.length < MIN_DISTRICT_LISTINGS) continue;
    const listingMedian = median(values);
    const deedMedian = deedByDistrict.get(district) ?? cityDeed;
    if (listingMedian == null || deedMedian == null) continue;
    const gap = vsPct(listingMedian, deedMedian);
    if (gap == null) continue;
    districts.push({
      district,
      vsDeedsPct: roundOrNull(gap) ?? 0,
      listingPpsm: Math.round(listingMedian),
      deedPpsm: Math.round(deedMedian),
      listingCount: values.length,
    });
  }
  districts.sort((a, b) => a.vsDeedsPct - b.vsDeedsPct);

  const sparkRaw = series.slice(-30).map((point) => point.listingPpsm);
  let lastSpark: number | null = sparkRaw.find((v) => v != null) ?? listingPpsm;
  const sparkline = sparkRaw.map((value) => {
    if (value != null) lastSpark = value;
    return lastSpark;
  });

  const payload: PricePulsePayload = {
    ok: true,
    city: WARSAW_CITY,
    source: RCN_SOURCE_LABEL,
    disclaimer: RCN_ATTRIBUTION,
    updatedAt: new Date().toISOString(),
    vsDeedsPct,
    listingPpsm,
    deedPpsm,
    tone,
    direction,
    windows: { d7, d30, d90 },
    trends,
    series,
    sparkline,
    districts: districts.slice(0, 12),
  };

  cache.at = now;
  cache.payload = payload;
  return payload;
}
