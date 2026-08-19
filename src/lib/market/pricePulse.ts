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
  PricePulseWindow,
} from '@/lib/market/types';
import { resolveWarsawDistrict } from '@/lib/market/warsawDistricts';

const CACHE_MS = 60_000;
const LOOKBACK_DAYS = 180;
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
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000);

  const [txns, offers, areaStats] = await Promise.all([
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
  const tone = toneOf(d30.listingChangePct ?? d7.listingChangePct);
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
    series,
    sparkline: series.slice(-30).map((point) => point.listingPpsm),
    districts: districts.slice(0, 12),
  };

  cache.at = now;
  cache.payload = payload;
  return payload;
}
