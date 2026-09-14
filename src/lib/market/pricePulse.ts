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
import { formatPlDate, resolveRcnAsOfDate } from '@/lib/market/asOf';
import {
  MAX_ABS_DAY_PCT,
  MAX_ABS_MONTH_PCT,
  MAX_ABS_WEEK_PCT,
  MAX_ABS_YEAR_PCT,
  MIN_DAY_DEEDS,
  MIN_MONTH_DEEDS,
  MIN_WEEK_DEEDS,
  MIN_WINDOW_DEEDS,
  MIN_WINDOW_LISTINGS,
  MIN_YEAR_DEEDS,
  adjacentWindowChange,
  calendarMonthChange,
  collect,
  daysInMonth,
  isResidentialFlatDeed,
  isResidentialFlatListing,
  lastNMonths,
  median,
  pctChange,
  pulseAsOfDay,
  roundOrNull,
  sanitizeChangePct,
  trailingMonthsChange,
} from '@/lib/market/pricePulseMath';
import type {
  PricePulseDirection,
  PricePulseDistrict,
  PricePulsePayload,
  PricePulsePoint,
  PricePulseTone,
  PricePulseWindow,
} from '@/lib/market/types';
import { resolveWarsawDistrict } from '@/lib/market/warsawDistricts';

const CACHE_MS = 60_000;
const LOOKBACK_DAYS = 180;
const TREND_LOOKBACK_DAYS = 800;
const SERIES_DAYS = 90;
const ROLLING_DAYS = 7;
const MIN_DISTRICT_LISTINGS = 4;
const SHARE_TITLE = /udzia[łl]/i;

const cache: { at: number; payload: PricePulsePayload | null } = { at: 0, payload: null };

function dayKey(value: Date): string {
  return value.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
}

function enumerateDays(endDay: string, count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const [y, m, d] = endDay.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - i);
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

function vsPct(listing: number | null, deed: number | null): number | null {
  if (listing == null || deed == null || deed <= 0) return null;
  return ((listing - deed) / deed) * 100;
}

function directionOf(listingChangePct: number | null): PricePulseDirection {
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

function pulseLagNote(asOf: Date) {
  return `Akty RCN dla Warszawy są kompletne do ${formatPlDate(asOf)}. Procent to zmiana mediany zł/m² mieszkań (lokale mieszkalne, bez domów) w ostatnim pełnym miesiącu względem poprzedniego.`;
}

function pushPpsm(map: Map<string, number[]>, key: string, ppsm: number) {
  const list = map.get(key);
  if (list) list.push(ppsm);
  else map.set(key, [ppsm]);
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

function monthPoints(byDay: Map<string, number[]>, asOfDay: string, take: number, minSamples: number) {
  return lastNMonths(asOfDay, take).map((ym) => {
    const values = collect(byDay, daysInMonth(ym));
    const ppsm = values.length >= minSamples ? median(values) : null;
    return { key: ym, ppsm: ppsm != null ? Math.round(ppsm) : null };
  });
}

function windowStats(
  listings: Map<string, number[]>,
  deeds: Map<string, number[]>,
  listingDays: string[],
  deedDays: string[],
  size: number,
): PricePulseWindow {
  const listingCurrent = listingDays.slice(-size);
  const listingPrevious = listingDays.slice(Math.max(0, listingDays.length - size * 2), listingDays.length - size);
  const deedCurrent = deedDays.slice(-size);
  const deedPrevious = deedDays.slice(Math.max(0, deedDays.length - size * 2), deedDays.length - size);
  const listingValues = collect(listings, listingCurrent);
  const prevListingValues = collect(listings, listingPrevious);
  const deedValues = collect(deeds, deedCurrent);
  const prevDeedValues = collect(deeds, deedPrevious);
  const listingPpsm = listingValues.length >= MIN_WINDOW_LISTINGS ? median(listingValues) : null;
  const prevListing = prevListingValues.length >= MIN_WINDOW_LISTINGS ? median(prevListingValues) : null;
  const deedMin = size <= 7 ? MIN_WEEK_DEEDS : MIN_WINDOW_DEEDS;
  const deedPpsm = deedValues.length >= deedMin ? median(deedValues) : null;
  const prevDeed = prevDeedValues.length >= deedMin ? median(prevDeedValues) : null;
  const listingMaxAbs = size <= 7 ? 12 : size <= 30 ? 10 : 15;
  const deedMaxAbs = size <= 7 ? MAX_ABS_WEEK_PCT : size <= 30 ? MAX_ABS_MONTH_PCT : 15;
  return {
    days: size,
    listingPpsm: listingPpsm != null ? Math.round(listingPpsm) : null,
    deedPpsm: deedPpsm != null ? Math.round(deedPpsm) : null,
    vsDeedsPct: roundOrNull(vsPct(listingPpsm, deedPpsm)),
    listingChangePct: sanitizeChangePct(pctChange(listingPpsm, prevListing), listingMaxAbs),
    deedChangePct: sanitizeChangePct(pctChange(deedPpsm, prevDeed), deedMaxAbs),
    listingCount: listingValues.length,
    deedCount: deedValues.length,
  };
}

export async function buildPricePulse(): Promise<PricePulsePayload> {
  const now = Date.now();
  if (cache.payload && now - cache.at < CACHE_MS) return cache.payload;

  await ensureMarketTables();

  const today = dayKey(new Date());
  const asOf = await resolveRcnAsOfDate(WARSAW_CITY);
  const asOfDay = pulseAsOfDay(dayKey(asOf));
  const seriesDays = enumerateDays(today, SERIES_DAYS);
  const listingLookback = enumerateDays(today, LOOKBACK_DAYS);
  const deedLookback = enumerateDays(asOfDay, LOOKBACK_DAYS);
  const trendDays = enumerateDays(asOfDay, TREND_LOOKBACK_DAYS);
  const listingSince = new Date(Date.now() - LOOKBACK_DAYS * 86400000);
  const deedSince = new Date(asOf.getTime() - TREND_LOOKBACK_DAYS * 86400000);

  const [txns, offers, areaStats] = await Promise.all([
    prisma.marketTransaction.findMany({
      where: {
        city: WARSAW_CITY,
        kind: MARKET_KIND_LOCAL,
        qualityOk: true,
        deedAt: { gte: deedSince, lte: asOf },
        pricePerM2: { not: null },
      },
      select: {
        deedAt: true,
        pricePerM2: true,
        district: true,
        functionCode: true,
        transactionKind: true,
      },
    }),
    prisma.offer.findMany({
      where: {
        transactionType: 'SELL',
        propertyType: 'FLAT',
        status: { in: ['ACTIVE', 'SOLD', 'ARCHIVED', 'IN_DEAL'] },
        createdAt: { gte: listingSince },
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
        propertyType: true,
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
  ]);

  const listingsByDay = new Map<string, number[]>();
  const deedsByDay = new Map<string, number[]>();
  const listingsByDistrict = new Map<string, number[]>();

  for (const row of txns) {
    if (!row.deedAt || row.pricePerM2 == null) continue;
    if (!isResidentialFlatDeed(row)) continue;
    const ppsm = Number(row.pricePerM2);
    if (!Number.isFinite(ppsm) || ppsm < QUALITY_MIN_PPSM || ppsm > QUALITY_MAX_PPSM) continue;
    pushPpsm(deedsByDay, dayKey(row.deedAt), ppsm);
  }

  for (const offer of offers) {
    if (!isResidentialFlatListing(offer.propertyType)) continue;
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

  const dayTrend = adjacentWindowChange(deedsByDay, asOfDay, 1, MIN_DAY_DEEDS, MAX_ABS_DAY_PCT);
  const weekTrend = adjacentWindowChange(deedsByDay, asOfDay, 7, MIN_WEEK_DEEDS, MAX_ABS_WEEK_PCT);
  const monthTrend = calendarMonthChange(deedsByDay, asOfDay, MIN_MONTH_DEEDS, MAX_ABS_MONTH_PCT);
  const yearTrend = trailingMonthsChange(deedsByDay, asOfDay, 12, MIN_YEAR_DEEDS, MAX_ABS_YEAR_PCT);

  const trends: PricePulsePayload['trends'] = {
    day: {
      key: 'day',
      changePct: dayTrend.changePct,
      currentPpsm: dayTrend.currentPpsm,
      previousPpsm: dayTrend.previousPpsm,
      count: dayTrend.count,
      points: bucketSeries(deedsByDay, trendDays, (day) => day, 21, MIN_DAY_DEEDS).map((row) => ({
        key: row.key,
        ppsm: row.ppsm,
      })),
    },
    week: {
      key: 'week',
      changePct: weekTrend.changePct,
      currentPpsm: weekTrend.currentPpsm,
      previousPpsm: weekTrend.previousPpsm,
      count: weekTrend.count,
      points: bucketSeries(deedsByDay, trendDays, isoWeekKey, 12, MIN_WEEK_DEEDS).map((row) => ({
        key: row.key,
        ppsm: row.ppsm,
      })),
    },
    month: {
      key: 'month',
      changePct: monthTrend.changePct,
      currentPpsm: monthTrend.currentPpsm,
      previousPpsm: monthTrend.previousPpsm,
      count: monthTrend.count,
      points: monthPoints(deedsByDay, asOfDay, 12, MIN_MONTH_DEEDS),
    },
    year: {
      key: 'year',
      changePct: yearTrend.changePct,
      currentPpsm: yearTrend.currentPpsm,
      previousPpsm: yearTrend.previousPpsm,
      count: yearTrend.count,
      points: monthPoints(deedsByDay, asOfDay, 24, MIN_MONTH_DEEDS),
    },
  };

  const series: PricePulsePoint[] = seriesDays.map((date, index) => {
    const listingPpsm = rollingMedian(listingsByDay, seriesDays, index, ROLLING_DAYS);
    const deedDays = enumerateDays(date, ROLLING_DAYS);
    const deedValues = date <= asOfDay ? collect(deedsByDay, deedDays) : [];
    const deedPpsm = deedValues.length >= MIN_WEEK_DEEDS ? median(deedValues) : null;
    return {
      date,
      listingPpsm: listingPpsm != null ? Math.round(listingPpsm) : null,
      deedPpsm: deedPpsm != null ? Math.round(deedPpsm) : null,
      vsDeedsPct: roundOrNull(vsPct(listingPpsm, deedPpsm)),
    };
  });

  const d7 = windowStats(listingsByDay, deedsByDay, listingLookback, deedLookback, 7);
  const d30 = windowStats(listingsByDay, deedsByDay, listingLookback, deedLookback, 30);
  const d90 = windowStats(listingsByDay, deedsByDay, listingLookback, deedLookback, 90);

  const vsDeedsPct = d30.vsDeedsPct ?? d7.vsDeedsPct;
  const listingPpsm = d30.listingPpsm ?? d7.listingPpsm;
  const deedPpsm = d30.deedPpsm ?? d7.deedPpsm;
  const deedTrendPct = trends.month.changePct ?? trends.week.changePct ?? trends.year.changePct;
  const tone = toneOf(deedTrendPct);
  const direction = directionOf(d30.listingChangePct ?? d7.listingChangePct);

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

  const sparkRaw = trends.month.points.map((point) => point.ppsm);
  let lastSpark: number | null = sparkRaw.find((v) => v != null) ?? monthTrend.currentPpsm ?? listingPpsm;
  const sparkline = sparkRaw.map((value) => {
    if (value != null) lastSpark = value;
    return lastSpark;
  });

  const payload: PricePulsePayload = {
    ok: true,
    city: WARSAW_CITY,
    source: RCN_SOURCE_LABEL,
    disclaimer: `${RCN_ATTRIBUTION} Puls liczy lokale mieszkalne (mieszkania), bez domów, działek i udziałów. Miesiąc to ostatni pełny miesiąc kompletnych aktów względem poprzedniego, nie ostatnie 30 dni od dziś.`,
    updatedAt: new Date().toISOString(),
    asOf: asOf.toISOString(),
    lagNote: pulseLagNote(asOf),
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
