import { prisma } from '@/lib/prisma';
import { canonicalizeCity } from '@/lib/location/locationCatalog';
import { DEFAULT_EUR_PLN_RATE } from '@/lib/money/constants';
import { getNbpEurPlnRate } from '@/lib/money/nbpEurPln';
import { canShowOfferOnPublicMarket } from '@/lib/offerMarketVisibility';
import { activePublicationOfferIds } from '@/lib/offerPublication';
import { legalStatusOverridesForOffers } from '@/lib/offerLegalStatusOverlay';
import { shapePublicListOffer, type PublicListOffer } from '@/lib/offers/publicListShape';
import {
  MARKET_KIND_LOCAL,
  QUALITY_MAX_PPSM,
  QUALITY_MIN_PPSM,
  RCN_SOURCE_LABEL,
  WARSAW_CITY,
} from '@/lib/market/constants';
import { ensureMarketTables } from '@/lib/market/ensureMarketTables';
import { formatTapeDelta } from '@/lib/market/format';
import { resolveWarsawDistrict } from '@/lib/market/warsawDistricts';
import { normalizeTransactionType } from '@/lib/transactionType';

export type ListingTapeTone = 'good' | 'fair' | 'high' | 'low';

export type ListingTapeMeta = {
  vsMedianPct: number;
  listingPpsm: number;
  medianPpsm: number;
  score: number;
  tone: ListingTapeTone;
  label: string;
  district: string;
};

export type ListingTapeOffer = PublicListOffer & { marketTape: ListingTapeMeta };

const TAPE_LIMIT = 48;
const MIN_MEDIAN_TXNS = 8;
const CACHE_MS = 60_000;

const cache = new Map<
  string,
  {
    at: number;
    payload: {
      ok: true;
      title: string;
      source: string;
      periodDays: number;
      items: ListingTapeOffer[];
    };
  }
>();

function isFlat(propertyType: unknown) {
  const t = String(propertyType || '')
    .trim()
    .toUpperCase();
  return t.includes('FLAT') || t.includes('APART') || t.includes('MIESZKAN');
}

function tapeTone(vsMedianPct: number): ListingTapeTone {
  if (Math.abs(vsMedianPct) <= 6) return 'good';
  if (vsMedianPct >= 8) return 'high';
  if (vsMedianPct <= -8) return 'low';
  return 'fair';
}

function tapeScore(vsMedianPct: number) {
  return Math.round(Math.min(99, Math.max(15, 100 - Math.abs(vsMedianPct) * 3.5)));
}

async function loadMedianByDistrict(periodDays: number): Promise<{
  cityMedian: number | null;
  byDistrict: Map<string, number>;
}> {
  const rows = await prisma.marketAreaStat.findMany({
    where: {
      city: WARSAW_CITY,
      periodDays,
      kind: MARKET_KIND_LOCAL,
      marketType: 'all',
      txnCount: { gte: MIN_MEDIAN_TXNS },
      medianPpsm: { not: null },
    },
    select: { district: true, medianPpsm: true },
  });
  const byDistrict = new Map<string, number>();
  let cityMedian: number | null = null;
  for (const row of rows) {
    if (row.medianPpsm == null) continue;
    if (!row.district) {
      cityMedian = row.medianPpsm;
      continue;
    }
    byDistrict.set(row.district, row.medianPpsm);
  }
  if (cityMedian != null || byDistrict.size) {
    return { cityMedian, byDistrict };
  }

  const since = new Date();
  since.setDate(since.getDate() - periodDays);
  const txns = await prisma.marketTransaction.findMany({
    where: {
      city: WARSAW_CITY,
      kind: MARKET_KIND_LOCAL,
      qualityOk: true,
      deedAt: { gte: since },
      pricePerM2: { not: null },
    },
    select: { district: true, pricePerM2: true },
  });
  const buckets = new Map<string, number[]>();
  for (const row of txns) {
    if (row.pricePerM2 == null) continue;
    const key = row.district || '';
    const list = buckets.get(key) || [];
    list.push(row.pricePerM2);
    buckets.set(key, list);
  }
  const medianOf = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const live = new Map<string, number>();
  let liveCity: number | null = null;
  for (const [district, values] of buckets) {
    if (values.length < MIN_MEDIAN_TXNS) continue;
    const median = medianOf(values);
    if (!district) liveCity = median;
    else live.set(district, median);
  }
  if (liveCity == null && txns.length >= MIN_MEDIAN_TXNS) {
    liveCity = medianOf(txns.map((t) => t.pricePerM2!).filter((n) => Number.isFinite(n)));
  }
  return { cityMedian: liveCity, byDistrict: live };
}

export async function buildListingTape(opts?: { limit?: number; locale?: string }): Promise<{
  ok: true;
  title: string;
  source: string;
  periodDays: number;
  items: ListingTapeOffer[];
}> {
  const limit = Math.min(80, Math.max(8, opts?.limit ?? TAPE_LIMIT));
  const locale = opts?.locale || 'pl';
  const cacheKey = `${locale}:${limit}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && now - hit.at < CACHE_MS) {
    return hit.payload;
  }

  await ensureMarketTables();
  const periodDays = 365;
  const { cityMedian, byDistrict } = await loadMedianByDistrict(periodDays);

  const offers = await prisma.offer.findMany({
    where: {
      status: 'ACTIVE',
      transactionType: 'SELL',
      propertyType: 'FLAT',
      lat: { not: null },
      lng: { not: null },
      area: { gte: 15 },
    },
    orderBy: { updatedAt: 'desc' },
    take: 400,
    select: {
      id: true,
      title: true,
      description: true,
      transactionType: true,
      propertyType: true,
      condition: true,
      price: true,
      priceCurrency: true,
      pricePln: true,
      pricePerSqm: true,
      area: true,
      rooms: true,
      floor: true,
      city: true,
      district: true,
      localityCountry: true,
      localityCountryCode: true,
      street: true,
      lat: true,
      lng: true,
      images: true,
      status: true,
      expiresAt: true,
      promotedUntil: true,
      createdAt: true,
      updatedAt: true,
      isLegalSafeVerified: true,
      user: { select: { role: true, planType: true, isPro: true } },
    },
  });

  const activeIds = await activePublicationOfferIds(offers.map((o) => o.id));
  const visible = offers.filter((offer) => canShowOfferOnPublicMarket(offer, activeIds));

  type Ranked = {
    offer: (typeof visible)[number];
    vsMedianPct: number;
    listingPpsm: number;
    medianPpsm: number;
    district: string;
  };
  const ranked: Ranked[] = [];

  for (const offer of visible) {
    if (!isFlat(offer.propertyType)) continue;
    if (normalizeTransactionType(offer.transactionType) !== 'sale') continue;
    if (canonicalizeCity(offer.city) !== WARSAW_CITY) continue;
    if (/udzia[łl]/i.test(String(offer.title || ''))) continue;
    const area = Number(offer.area);
    const price = Number(offer.pricePln ?? offer.price ?? 0);
    if (!Number.isFinite(area) || area < 15 || !Number.isFinite(price) || price < 80_000) continue;
    const listingPpsm = price / area;
    if (listingPpsm < QUALITY_MIN_PPSM || listingPpsm > QUALITY_MAX_PPSM) continue;
    const district =
      resolveWarsawDistrict({
        street: offer.street,
        lat: offer.lat,
        lng: offer.lng,
      }) ||
      (offer.district && offer.district !== 'OTHER' ? offer.district : null);
    const medianPpsm =
      (district ? byDistrict.get(district) : null) || cityMedian;
    if (medianPpsm == null || medianPpsm <= 0) continue;
    const vsMedianPct = ((listingPpsm - medianPpsm) / medianPpsm) * 100;
    ranked.push({
      offer,
      vsMedianPct: Number(vsMedianPct.toFixed(1)),
      listingPpsm: Math.round(listingPpsm),
      medianPpsm: Math.round(medianPpsm),
      district: district || WARSAW_CITY,
    });
  }

  ranked.sort((a, b) => a.vsMedianPct - b.vsMedianPct);
  const sliced = ranked.slice(0, limit);

  let fx = { rate: DEFAULT_EUR_PLN_RATE, date: new Date().toISOString().slice(0, 10) };
  try {
    const nbp = await getNbpEurPlnRate();
    fx = { rate: nbp.rate, date: nbp.date };
  } catch {
    /* fallback */
  }
  const legalOverrides = await legalStatusOverridesForOffers(
    prisma,
    sliced.map((row) => row.offer.id),
  );

  const items: ListingTapeOffer[] = sliced.map((row) => {
    const shaped = shapePublicListOffer(row.offer as unknown as Record<string, unknown>, {
      viewsCount: 0,
      fx,
      legalOverrides,
    });
    const vs = row.vsMedianPct;
    return {
      ...shaped,
      marketTape: {
        vsMedianPct: vs,
        listingPpsm: row.listingPpsm,
        medianPpsm: row.medianPpsm,
        score: tapeScore(vs),
        tone: tapeTone(vs),
        label: formatTapeDelta(vs, locale),
        district: row.district,
      },
    };
  });

  const payload = {
    ok: true as const,
    title: 'Przy aktach',
    source: RCN_SOURCE_LABEL,
    periodDays,
    items,
  };
  cache.set(cacheKey, { at: now, payload });
  return payload;
}
