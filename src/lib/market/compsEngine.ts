import {
  COMPS_MAX_RETURN,
  COMPS_MIN_COUNT,
  COMPS_RADIUS_STEPS_M,
  COMPS_TARGET_COUNT,
  DEFAULT_COMPS_MONTHS,
  FALLBACK_COMPS_MONTHS,
  AREA_TOLERANCE,
  ROOMS_TOLERANCE,
  MARKET_KIND_LOCAL,
  RCN_ATTRIBUTION,
  RCN_SOURCE_LABEL,
  WARSAW_CITY,
} from '@/lib/market/constants';
import { prisma } from '@/lib/prisma';
import { ensureMarketTables } from '@/lib/market/ensureMarketTables';
import { marketPriceScore } from '@/lib/market/format';
import { sortCompsBySimilarity } from '@/lib/market/compSimilarity';
import { haversineMeters } from '@/lib/market/warsawDistricts';
import type { MarketComp, PriceScore, ValuationResult, ValuationSubject } from '@/lib/market/types';

function monthsAgo(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function roundMoney(n: number) {
  return Math.round(n / 1000) * 1000;
}

function bboxFor(lat: number, lng: number, radiusM: number) {
  const km = radiusM / 1000;
  const dLat = km / 111.32;
  const dLng = km / (111.32 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return {
    latMin: lat - dLat,
    latMax: lat + dLat,
    lngMin: lng - dLng,
    lngMax: lng + dLng,
  };
}

function similarEnough(
  row: { areaM2: number | null; rooms: number | null },
  subject: ValuationSubject,
) {
  if (row.areaM2 == null) return false;
  const areaOk =
    row.areaM2 >= subject.area * (1 - AREA_TOLERANCE) &&
    row.areaM2 <= subject.area * (1 + AREA_TOLERANCE);
  if (!areaOk) return false;
  if (subject.rooms == null || row.rooms == null) return true;
  return Math.abs(row.rooms - subject.rooms) <= ROOMS_TOLERANCE;
}

function scoreListing(listingPpsm: number, medianPpsm: number, compsPpsm: number[]): PriceScore {
  const vsMedianPct = medianPpsm > 0 ? ((listingPpsm - medianPpsm) / medianPpsm) * 100 : 0;
  const score = marketPriceScore(vsMedianPct);
  const sorted = [...compsPpsm].sort((a, b) => a - b);
  const inUpper = listingPpsm >= percentile(sorted, 0.75);
  let tone: PriceScore['tone'] = 'fair';
  let label = 'W okolicy rynku';
  if (score >= 80 && Math.abs(vsMedianPct) <= 6) {
    tone = 'good';
    label = 'Dobrze wyceniona';
  } else if (vsMedianPct >= 8) {
    tone = 'high';
    label = 'Powyżej porównywalnych transakcji';
  } else if (vsMedianPct <= -8) {
    tone = 'low';
    label = 'Poniżej porównywalnych transakcji';
  }
  const absPct = Math.abs(vsMedianPct).toFixed(1).replace('.', ',');
  const detail =
    vsMedianPct >= 0
      ? inUpper
        ? `Cena ofertowa jest około ${absPct}% powyżej mediany porównywalnych aktów i leży w górnej ćwiartce zakresu.`
        : `Cena ofertowa jest około ${absPct}% powyżej mediany porównywalnych transakcji.`
      : `Cena ofertowa jest około ${absPct}% poniżej mediany porównywalnych transakcji.`;
  return { score, tone, label, detail, vsMedianPct: Number(vsMedianPct.toFixed(1)) };
}

type Candidate = {
  id: number;
  deedAt: Date | null;
  areaM2: number | null;
  rooms: number | null;
  floor: number | null;
  priceGross: number;
  pricePerM2: number;
  address: string | null;
  district: string | null;
  marketType: string | null;
  lat: number;
  lng: number;
};

async function loadCandidates(
  subject: ValuationSubject,
  radiusM: number,
  since: Date,
): Promise<Candidate[]> {
  const box = bboxFor(subject.lat, subject.lng, radiusM);
  const market =
    subject.marketType && subject.marketType !== 'all' ? subject.marketType : undefined;
  const rows = await prisma.marketTransaction.findMany({
    where: {
      kind: MARKET_KIND_LOCAL,
      qualityOk: true,
      city: subject.city || WARSAW_CITY,
      deedAt: { gte: since },
      lat: { gte: box.latMin, lte: box.latMax },
      lng: { gte: box.lngMin, lte: box.lngMax },
      priceGross: { not: null },
      pricePerM2: { not: null },
      ...(market ? { marketType: market } : {}),
    },
    select: {
      id: true,
      deedAt: true,
      areaM2: true,
      rooms: true,
      floor: true,
      priceGross: true,
      pricePerM2: true,
      address: true,
      district: true,
      marketType: true,
      lat: true,
      lng: true,
    },
    take: 900,
  });
  return rows.filter(
    (r): r is Candidate =>
      r.lat != null &&
      r.lng != null &&
      r.priceGross != null &&
      r.pricePerM2 != null,
  );
}

function toComps(rows: Candidate[], subject: ValuationSubject): MarketComp[] {
  const comps = rows.map((r) => ({
    id: r.id,
    deedAt: r.deedAt ? r.deedAt.toISOString().slice(0, 10) : null,
    area: r.areaM2,
    rooms: r.rooms,
    floor: r.floor,
    price: Math.round(r.priceGross),
    ppsm: Math.round(r.pricePerM2),
    address: r.address,
    district: r.district,
    distanceM: Math.round(haversineMeters(subject.lat, subject.lng, r.lat, r.lng)),
    marketType: r.marketType,
    lat: r.lat,
    lng: r.lng,
  }));
  return sortCompsBySimilarity(comps, subject).slice(0, COMPS_MAX_RETURN);
}

async function districtOrCityMedian(subject: ValuationSubject, since: Date) {
  const city = subject.city || WARSAW_CITY;
  const districtWhere = {
    kind: MARKET_KIND_LOCAL,
    qualityOk: true,
    city,
    deedAt: { gte: since },
    pricePerM2: { not: null },
  };
  const districtRows = subject.district
    ? await prisma.marketTransaction.findMany({
        where: { ...districtWhere, district: subject.district },
        select: { pricePerM2: true },
        take: 2000,
      })
    : [];
  const cityRows =
    districtRows.length >= 12
      ? districtRows
      : await prisma.marketTransaction.findMany({
          where: districtWhere,
          select: { pricePerM2: true },
          take: 4000,
        });
  const values = cityRows.map((r) => r.pricePerM2!).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  return {
    values,
    basis: (districtRows.length >= 12 ? 'district' : 'city') as 'district' | 'city',
    count: values.length,
  };
}

export async function valueProperty(
  subject: ValuationSubject,
  listingPrice?: number | null,
): Promise<ValuationResult | { ok: false; code: string; message: string }> {
  await ensureMarketTables();
  if (!Number.isFinite(subject.lat) || !Number.isFinite(subject.lng) || !Number.isFinite(subject.area) || subject.area < 10) {
    return {
      ok: false,
      code: 'INCOMPLETE',
      message: 'Podaj lokalizację (pinezka) i powierzchnię, żeby EstateOS™ policzył wycenę z aktów RCN.',
    };
  }

  const coverageCount = await prisma.marketTransaction.count({
    where: { city: subject.city || WARSAW_CITY, qualityOk: true },
  });
  const lastIngest = await prisma.marketIngestRun.findFirst({
    where: { status: 'SUCCESS' },
    orderBy: { finishedAt: 'desc' },
    select: { finishedAt: true },
  });

  if (coverageCount < 30) {
    return {
      ok: false,
      code: 'SYNCING',
      message:
        'EstateOS™ Market synchronizuje Rejestr Cen Nieruchomości dla Warszawy. Wycena z aktów będzie dostępna po pierwszym imporcie.',
    };
  }

  let windowMonths = DEFAULT_COMPS_MONTHS;
  let used: Candidate[] = [];
  let radiusM = COMPS_RADIUS_STEPS_M[0];

  for (const months of [DEFAULT_COMPS_MONTHS, FALLBACK_COMPS_MONTHS]) {
    windowMonths = months;
    const since = monthsAgo(months);
    used = [];
    for (const step of COMPS_RADIUS_STEPS_M) {
      radiusM = step;
      const raw = await loadCandidates(subject, step, since);
      const close = raw.filter((r) => haversineMeters(subject.lat, subject.lng, r.lat, r.lng) <= step);
      used = close.filter((r) => similarEnough(r, subject));
      if (used.length >= COMPS_TARGET_COUNT) break;
    }
    if (used.length >= COMPS_MIN_COUNT) break;
  }

  let basis: ValuationResult['stats']['basis'] = 'comps';
  let ppsmValues = used.map((r) => r.pricePerM2).sort((a, b) => a - b);

  if (ppsmValues.length < COMPS_MIN_COUNT) {
    const fallback = await districtOrCityMedian(subject, monthsAgo(FALLBACK_COMPS_MONTHS));
    if (fallback.values.length < 8) {
      return {
        ok: false,
        code: 'NO_SAMPLE',
        message:
          'Za mało wiarygodnych aktów RCN w okolicy tej nieruchomości. Uzupełnij metraż i lokalizację albo spróbuj innej dzielnicy Warszawy.',
      };
    }
    ppsmValues = fallback.values;
    basis = fallback.basis;
    used = [];
  }

  const medianPpsm = percentile(ppsmValues, 0.5);
  const meanPpsm = mean(ppsmValues);
  const p25 = percentile(ppsmValues, 0.25);
  const p75 = percentile(ppsmValues, 0.75);
  const mid = roundMoney(medianPpsm * subject.area);
  const low = roundMoney(p25 * subject.area);
  const high = roundMoney(p75 * subject.area);
  const recommendedAsk = roundMoney(medianPpsm * subject.area * 1.012);

  const listingPpsm =
    listingPrice && listingPrice > 0 && subject.area > 0 ? listingPrice / subject.area : null;

  const result: ValuationResult = {
    ok: true,
    subject,
    listingPrice: listingPrice && listingPrice > 0 ? roundMoney(listingPrice) : null,
    estimated: {
      low: Math.min(low, mid),
      mid,
      high: Math.max(high, mid),
      ppsm: Math.round(medianPpsm),
      recommendedAsk,
    },
    stats: {
      medianPpsm: Math.round(medianPpsm),
      meanPpsm: Math.round(meanPpsm),
      count: basis === 'comps' ? used.length : ppsmValues.length,
      radiusM: basis === 'comps' ? radiusM : 0,
      windowMonths,
      basis,
    },
    vsListing: listingPpsm ? scoreListing(listingPpsm, medianPpsm, ppsmValues) : null,
    comps: toComps(used, subject),
    coverage: {
      city: subject.city || WARSAW_CITY,
      source: RCN_SOURCE_LABEL,
      ingestedAt: lastIngest?.finishedAt ? lastIngest.finishedAt.toISOString() : null,
      transactionCount: coverageCount,
      disclaimer: RCN_ATTRIBUTION,
    },
  };
  return result;
}
