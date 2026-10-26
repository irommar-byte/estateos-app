import { prisma } from '@/lib/prisma';
import { getKeiWorkerQueueHealth } from '@/lib/keiImportLease';
import { listAiUsage } from '@/lib/openAiClient';
import type { KeiImportJobItem } from '@/lib/keiAmerImportJobs';

/**
 * Analityka importu KEI do strony „Import — centrum sterowania”.
 * Wszystko liczone z historii zadań (KeiAmerImportJob), stanu ogłoszeń, ofert i zużycia AI.
 */

export type KeiAnalyticsRange = '7' | '30' | '90' | 'all';

type JobRow = {
  id: string;
  status: string;
  payloadJson: string | null;
  itemsJson: string | null;
  createdAt: Date;
  finishedAt: Date | null;
};

const dayKey = (date: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(date);
const warsawHour = (date: Date) =>
  Number(new Intl.DateTimeFormat('pl-PL', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Warsaw' }).format(date)) % 24;

function normalizeReason(reason: string): string {
  return reason
    .replace(/#\d+/g, '#…')
    .replace(/\(oferta #…\)/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\d{2,}/g, 'N')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

const PRICE_BUCKETS = [
  { id: 'lt500', label: 'do 500 tys.', max: 500_000 },
  { id: '500-800', label: '500–800 tys.', max: 800_000 },
  { id: '800-1200', label: '0,8–1,2 mln', max: 1_200_000 },
  { id: '1200-2000', label: '1,2–2 mln', max: 2_000_000 },
  { id: 'gt2000', label: 'powyżej 2 mln', max: Infinity },
];

export async function buildKeiImportAnalytics(range: KeiAnalyticsRange) {
  const days = range === 'all' ? null : Number(range);
  const since = days ? new Date(Date.now() - days * 86_400_000) : null;

  const jobs = (await prisma.$queryRawUnsafe(
    `SELECT id, status, payloadJson, itemsJson, createdAt, finishedAt
     FROM KeiAmerImportJob
     ${since ? 'WHERE createdAt >= ?' : ''}
     ORDER BY createdAt ASC
     LIMIT 6000`,
    ...(since ? [since] : []),
  )) as JobRow[];

  const daily = new Map<string, { day: string; published: number; review: number; duplicates: number; errors: number; other: number; cycles: number }>();
  const ensureDay = (key: string) => {
    let row = daily.get(key);
    if (!row) {
      row = { day: key, published: 0, review: 0, duplicates: 0, errors: 0, other: 0, cycles: 0 };
      daily.set(key, row);
    }
    return row;
  };
  // Ciągła oś dni — puste dni też widać na wykresie.
  const firstDay = since ?? (jobs[0] ? new Date(jobs[0].createdAt) : new Date());
  for (let t = new Date(dayKey(firstDay)).getTime(); t <= Date.now(); t += 86_400_000) ensureDay(dayKey(new Date(t)));

  const totals = {
    cycles: 0,
    autoCycles: 0,
    manualRuns: 0,
    failedCycles: 0,
    published: 0,
    review: 0,
    duplicates: 0,
    errors: 0,
    inactive: 0,
    quality: 0,
    blocked: 0,
    aiRewritten: 0,
    processed: 0,
  };
  const reasons = new Map<string, number>();
  const districts = new Map<string, number>();
  const priceBuckets = new Map<string, number>(PRICE_BUCKETS.map((b) => [b.id, 0]));
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, published: 0, processed: 0 }));
  const durations: number[] = [];
  const recent: Array<{
    id: string;
    status: string;
    source: string;
    createdAt: string;
    published: number;
    review: number;
    skipped: number;
    errors: number;
    durationSeconds: number | null;
    thumbs: string[];
  }> = [];
  let firstJobAt: string | null = null;

  for (const job of jobs) {
    let items: KeiImportJobItem[] = [];
    let source = 'manual';
    try {
      items = JSON.parse(job.itemsJson || '[]');
    } catch {
      items = [];
    }
    try {
      source = (JSON.parse(job.payloadJson || '{}') as { source?: string }).source === 'auto' ? 'auto' : 'manual';
    } catch {
      /* stare zadanie */
    }
    const created = new Date(job.createdAt);
    firstJobAt ||= created.toISOString();
    const day = ensureDay(dayKey(created));
    day.cycles += 1;
    totals.cycles += 1;
    if (source === 'auto') totals.autoCycles += 1;
    else totals.manualRuns += 1;
    if (job.status === 'error') totals.failedCycles += 1;

    let jobPublished = 0;
    let jobReview = 0;
    let jobSkipped = 0;
    let jobErrors = 0;
    for (const item of items) {
      if (item.status === 'pending' || item.status === 'active') continue;
      totals.processed += 1;
      const hourRow = hours[warsawHour(item.finishedAt ? new Date(item.finishedAt) : created)];
      hourRow.processed += 1;
      if (item.startedAt && item.finishedAt) {
        const ms = new Date(item.finishedAt).getTime() - new Date(item.startedAt).getTime();
        if (ms > 0 && ms < 30 * 60_000 && item.status === 'done') durations.push(ms / 1000);
      }
      if (item.status === 'done') {
        if (item.aiRewritten) totals.aiRewritten += 1;
        if (item.publishState === 'review') {
          totals.review += 1;
          day.review += 1;
          jobReview += 1;
        } else {
          totals.published += 1;
          day.published += 1;
          jobPublished += 1;
          hourRow.published += 1;
        }
        if (item.district) districts.set(item.district, (districts.get(item.district) || 0) + 1);
        if (item.price && item.price > 0) {
          const bucket = PRICE_BUCKETS.find((b) => Number(item.price) < b.max) || PRICE_BUCKETS[PRICE_BUCKETS.length - 1];
          priceBuckets.set(bucket.id, (priceBuckets.get(bucket.id) || 0) + 1);
        }
        continue;
      }
      jobSkipped += 1;
      const kind = item.skipKind || (/już|w bazie/i.test(item.reason || '') ? 'duplicate' : 'error');
      if (kind === 'duplicate') {
        totals.duplicates += 1;
        day.duplicates += 1;
      } else if (kind === 'error') {
        totals.errors += 1;
        day.errors += 1;
        jobErrors += 1;
        if (item.reason) {
          const key = normalizeReason(item.reason);
          reasons.set(key, (reasons.get(key) || 0) + 1);
        }
      } else {
        day.other += 1;
        if (kind === 'inactive') totals.inactive += 1;
        else if (kind === 'quality') totals.quality += 1;
        else totals.blocked += 1;
      }
    }
    recent.push({
      id: job.id,
      status: job.status,
      source,
      createdAt: created.toISOString(),
      published: jobPublished,
      review: jobReview,
      skipped: jobSkipped,
      errors: jobErrors,
      durationSeconds: job.finishedAt ? Math.round((new Date(job.finishedAt).getTime() - created.getTime()) / 1000) : null,
      thumbs: items.filter((i) => i.status === 'done' && i.thumbUrl).slice(0, 3).map((i) => String(i.thumbUrl)),
    });
  }

  const [listingRows, offerRows, reachRows, queue, aiRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT
         SUM(importedOfferId IS NOT NULL) AS imported,
         SUM(outreachSentAt IS NOT NULL AND importedOfferId IS NULL) AS outreach,
         SUM(failCount > 0 AND importedOfferId IS NULL) AS failing,
         SUM(ignoredAt IS NOT NULL) AS ignored
       FROM KeiAmerListingState`,
    ) as Promise<Array<Record<string, unknown>>>,
    prisma.$queryRawUnsafe(
      `SELECT o.status, COUNT(*) AS total
       FROM KeiAmerListingState kls
       JOIN \`Offer\` o ON o.id = kls.importedOfferId
       GROUP BY o.status`,
    ) as Promise<Array<{ status: string; total: number | bigint }>>,
    prisma.$queryRawUnsafe(
      `SELECT o.id, o.title, o.district, COUNT(v.id) AS visitors
       FROM KeiAmerListingState kls
       JOIN \`Offer\` o ON o.id = kls.importedOfferId
       LEFT JOIN OfferViewLog v ON v.offerId = o.id
       ${since ? 'WHERE kls.importedAt >= ?' : ''}
       GROUP BY o.id, o.title, o.district
       ORDER BY visitors DESC
       LIMIT 200`,
      ...(since ? [since] : []),
    ) as Promise<Array<{ id: number; title: string | null; district: string | null; visitors: number | bigint }>>,
    getKeiWorkerQueueHealth().catch(() => null),
    listAiUsage(days ?? 365).catch(() => []),
  ]);

  const listing = listingRows[0] || {};
  const avgSeconds = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
  const reach = reachRows.map((row) => ({
    id: Number(row.id),
    title: row.title || `Oferta #${row.id}`,
    district: row.district,
    visitors: Number(row.visitors || 0),
  }));
  const aiImport = aiRows.filter((row) => row.feature === 'import-rewrite');
  const aiByDay = new Map<string, { day: string; calls: number; failures: number; costUsd: number }>();
  for (const row of aiImport) {
    const entry = aiByDay.get(row.day) || { day: row.day, calls: 0, failures: 0, costUsd: 0 };
    entry.calls += row.calls;
    entry.failures += row.failures;
    entry.costUsd += row.costUsd;
    aiByDay.set(row.day, entry);
  }
  const attempts = totals.published + totals.review + totals.errors + totals.quality;

  return {
    range,
    generatedAt: new Date().toISOString(),
    firstJobAt,
    totals: {
      ...totals,
      successRate: attempts ? Math.round(((totals.published + totals.review) / attempts) * 100) : null,
      aiShare: totals.published + totals.review ? Math.round((totals.aiRewritten / (totals.published + totals.review)) * 100) : null,
      avgItemSeconds: avgSeconds,
    },
    daily: [...daily.values()].sort((a, b) => a.day.localeCompare(b.day)),
    hours,
    outcomes: [
      { id: 'published', label: 'Opublikowane', value: totals.published },
      { id: 'review', label: 'Szkice', value: totals.review },
      { id: 'duplicates', label: 'Już w bazie', value: totals.duplicates },
      { id: 'inactive', label: 'Nieaktualne', value: totals.inactive },
      { id: 'quality', label: 'Za słabe dane', value: totals.quality },
      { id: 'errors', label: 'Błędy', value: totals.errors },
    ],
    topErrors: [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([reason, count]) => ({ reason, count })),
    districts: [...districts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([district, count]) => ({ district, count })),
    prices: PRICE_BUCKETS.map((b) => ({ id: b.id, label: b.label, count: priceBuckets.get(b.id) || 0 })),
    pipeline: {
      imported: Number(listing.imported || 0),
      outreach: Number(listing.outreach || 0),
      failing: Number(listing.failing || 0),
      ignored: Number(listing.ignored || 0),
    },
    offerStatus: offerRows.map((row) => ({ status: String(row.status), count: Number(row.total || 0) })),
    reach: {
      totalVisitors: reach.reduce((a, r) => a + r.visitors, 0),
      offers: reach.length,
      top: reach.slice(0, 5),
    },
    ai: {
      daily: [...aiByDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
      calls: aiImport.reduce((a, r) => a + r.calls, 0),
      failures: aiImport.reduce((a, r) => a + r.failures, 0),
      costUsd: Number(aiImport.reduce((a, r) => a + r.costUsd, 0).toFixed(4)),
    },
    queue,
    recent: recent.reverse().slice(0, 25),
  };
}

export type KeiImportAnalytics = Awaited<ReturnType<typeof buildKeiImportAnalytics>>;
