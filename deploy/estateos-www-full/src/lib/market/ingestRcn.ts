import { prisma } from '@/lib/prisma';
import { INGEST_MONTHS, MARKET_KIND_LOCAL, WARSAW_CITY } from '@/lib/market/constants';
import { ensureMarketTables } from '@/lib/market/ensureMarketTables';
import { countWarsawResidentialSince, fetchWarsawResidentialPage } from '@/lib/market/rcnWfs';
import { assessRcnQuality } from '@/lib/market/rcnQuality';
import { resolveWarsawDistrict } from '@/lib/market/warsawDistricts';
import { recomputeWarsawAreaStats } from '@/lib/market/aggregates';
import type { RcnLocalFeature } from '@/lib/market/rcnParse';

const PAGE = 120;
const MAX_PAGES = 900;

function sinceDate() {
  const d = new Date();
  d.setMonth(d.getMonth() - INGEST_MONTHS);
  return d.toISOString().slice(0, 10);
}

function log(message: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), job: 'rcn-ingest', message, ...extra }));
}

export async function ingestWarsawRcn(opts?: { source?: string }): Promise<{
  fetched: number;
  upserted: number;
  skipped: number;
  matched: number | null;
}> {
  await ensureMarketTables();
  const running = await prisma.marketIngestRun.findFirst({
    where: { status: 'RUNNING' },
    orderBy: { startedAt: 'desc' },
  });
  if (running && Date.now() - running.startedAt.getTime() < 90 * 60 * 1000) {
    throw new Error('Import RCN już trwa.');
  }

  const run = await prisma.marketIngestRun.create({
    data: { status: 'RUNNING', source: opts?.source || 'wfs-warsaw-lokale' },
  });

  const since = sinceDate();
  let fetched = 0;
  let upserted = 0;
  let skipped = 0;
  let matched: number | null = null;

  try {
    matched = await countWarsawResidentialSince(since);
    log('hits', { matched, since });

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const startIndex = page * PAGE;
      const { features, returned } = await fetchWarsawResidentialPage({
        sinceIsoDate: since,
        startIndex,
        count: PAGE,
      });
      fetched += features.length;
      if (!features.length || returned === 0) break;

      const result = await persistFeatures(features);
      upserted += result.upserted;
      skipped += result.skipped;
      log('page', { page, startIndex, got: features.length, upserted: result.upserted });

      if (returned < PAGE || features.length < PAGE / 2) break;
      await new Promise((r) => setTimeout(r, 180));
    }

    await recomputeWarsawAreaStats();

    await prisma.marketIngestRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        fetched,
        upserted,
        skipped,
      },
    });
    log('done', { fetched, upserted, skipped, matched });
    return { fetched, upserted, skipped, matched };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.marketIngestRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        fetched,
        upserted,
        skipped,
        error: message.slice(0, 4000),
      },
    });
    throw error;
  }
}

function toRow(row: RcnLocalFeature) {
  const quality = assessRcnQuality(row);
  const district = resolveWarsawDistrict({ street: row.street, lat: row.lat, lng: row.lng });
  const city = row.city || WARSAW_CITY;
  const payload = {
    sourceIip: (row.sourceIip || row.gmlId).slice(0, 64),
    unitId: row.unitId ? row.unitId.slice(0, 191) : null,
    kind: MARKET_KIND_LOCAL,
    teryt: row.teryt || null,
    city,
    district,
    street: row.street ? row.street.slice(0, 191) : null,
    address: row.formattedAddress ? row.formattedAddress.slice(0, 255) : null,
    lat: row.lat,
    lng: row.lng,
    deedAt: row.deedAt,
    marketType: row.marketType,
    transactionKind: row.transactionKind,
    share: row.share || null,
    shareRatio: row.shareRatio,
    rooms: row.rooms != null ? Math.round(row.rooms) : null,
    floor: row.floor != null ? Math.round(row.floor) : null,
    areaM2: row.areaM2,
    ancillaryM2: row.ancillaryM2,
    functionCode: row.functionCode || null,
    priceGross: row.priceGross,
    vatAmount: row.vatAmount,
    pricePerM2: quality.ppsm,
    qualityOk: quality.ok,
    qualityFlags: quality.flags.join(',') || null,
  };
  return { gmlId: row.gmlId.slice(0, 64), payload };
}

async function persistFeatures(features: RcnLocalFeature[]) {
  let upserted = 0;
  let skipped = 0;
  const chunk = 20;
  for (let i = 0; i < features.length; i += chunk) {
    const slice = features.slice(i, i + chunk);
    const results = await Promise.all(
      slice.map(async (row) => {
        const mapped = toRow(row);
        try {
          await prisma.marketTransaction.upsert({
            where: { gmlId: mapped.gmlId },
            create: { gmlId: mapped.gmlId, ...mapped.payload },
            update: mapped.payload,
          });
          return 'ok' as const;
        } catch (error) {
          console.warn('[rcn-ingest] skip', row.gmlId, error instanceof Error ? error.message : error);
          return 'skip' as const;
        }
      }),
    );
    upserted += results.filter((r) => r === 'ok').length;
    skipped += results.filter((r) => r === 'skip').length;
  }
  return { upserted, skipped };
}
