import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { createOpenAiEmbedding, getOpenAiApiKey, openAiErrorMessage } from '@/lib/openAiClient';

const HARD_MONTHLY_LIMIT_MICROUSD = 10_000_000;
const SOFT_MONTHLY_LIMIT_MICROUSD = 8_000_000;
const DEFAULT_COST_MICROUSD_PER_MILLION_TOKENS = 20_000; // $0.02 / 1M tokens

function periodKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function trimText(value: string | null | undefined, max: number) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function discoveryEmbeddingInput(offer: {
  title: string;
  description: string | null;
  city: string;
  district: string;
  propertyType: string;
  transactionType: string;
  area: number;
  rooms: number | null;
  hasBalcony: boolean;
  hasParking: boolean;
  hasGarden: boolean;
  hasElevator: boolean;
}): string {
  const amenities = [
    offer.hasBalcony ? 'balkon' : null,
    offer.hasParking ? 'parking' : null,
    offer.hasGarden ? 'ogród' : null,
    offer.hasElevator ? 'winda' : null,
  ].filter(Boolean).join(', ');
  return trimText(
    [
      `Oferta nieruchomości: ${offer.title}`,
      `Lokalizacja: ${offer.district}, ${offer.city}`,
      `Typ: ${offer.propertyType}; transakcja: ${offer.transactionType}`,
      `Metraż: ${offer.area} m2; pokoje: ${offer.rooms ?? 'brak danych'}`,
      amenities ? `Udogodnienia: ${amenities}` : '',
      `Opis: ${trimText(offer.description, 2_400)}`,
    ].filter(Boolean).join('\n'),
    3_500,
  );
}

export function discoveryEmbeddingHash(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function estimatedCostMicroUsd(tokens: number) {
  const perMillion = Number(process.env.OPENAI_DISCOVERY_EMBEDDING_COST_MICROUSD_PER_MILLION || DEFAULT_COST_MICROUSD_PER_MILLION_TOKENS);
  return Math.ceil(Math.max(0, tokens) * Math.max(0, perMillion) / 1_000_000);
}

async function usageForCurrentMonth() {
  const key = periodKey();
  return prisma.discoveryAiUsage.upsert({
    where: { periodKey: key },
    create: { id: id('dau'), periodKey: key },
    update: {},
  });
}

export type DiscoveryEmbeddingBatchResult = {
  processed: number;
  skippedBudget: number;
  failed: number;
  spentMicrousd: number;
  periodKey: string;
};

/**
 * Cost-controlled batch worker. It is deliberately never called from the feed
 * request path: users queue work, while an authenticated worker processes it.
 */
export async function processDiscoveryEmbeddingBatch(limit = 20): Promise<DiscoveryEmbeddingBatchResult> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) throw new Error('OPENAI_API_KEY nie jest skonfigurowany dla Discovery embeddings.');
  const cappedLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const usage = await usageForCurrentMonth();
  const hardLimit = Number(process.env.OPENAI_DISCOVERY_MONTHLY_HARD_LIMIT_MICROUSD || HARD_MONTHLY_LIMIT_MICROUSD);
  const softLimit = Number(process.env.OPENAI_DISCOVERY_MONTHLY_SOFT_LIMIT_MICROUSD || SOFT_MONTHLY_LIMIT_MICROUSD);
  if (usage.costMicrousd >= hardLimit) {
    return { processed: 0, skippedBudget: cappedLimit, failed: 0, spentMicrousd: 0, periodKey: usage.periodKey };
  }
  const effectiveLimit = usage.costMicrousd >= softLimit ? Math.min(3, cappedLimit) : cappedLimit;
  const jobs = await prisma.discoveryEmbeddingJob.findMany({
    where: { status: 'PENDING' },
    orderBy: { requestedAt: 'asc' },
    take: effectiveLimit,
  });
  let processed = 0;
  let failed = 0;
  let spentMicrousd = 0;

  for (const job of jobs) {
    const claimed = await prisma.discoveryEmbeddingJob.updateMany({
      where: { id: job.id, status: 'PENDING' },
      data: { status: 'PROCESSING' },
    });
    if (!claimed.count) continue;
    try {
      const offer = await prisma.offer.findUnique({
        where: { id: job.offerId },
        select: {
          title: true, description: true, city: true, district: true, propertyType: true,
          transactionType: true, area: true, rooms: true, hasBalcony: true, hasParking: true,
          hasGarden: true, hasElevator: true,
        },
      });
      if (!offer) {
        await prisma.discoveryEmbeddingJob.update({ where: { id: job.id }, data: { status: 'FAILED', errorCode: 'OFFER_NOT_FOUND' } });
        failed += 1;
        continue;
      }
      const input = discoveryEmbeddingInput(offer);
      const hash = discoveryEmbeddingHash(input);
      if (job.inputHash === hash && Array.isArray(job.vector)) {
        await prisma.discoveryEmbeddingJob.update({ where: { id: job.id }, data: { status: 'READY', processedAt: new Date() } });
        continue;
      }
      const latestUsage = await usageForCurrentMonth();
      if (latestUsage.costMicrousd >= hardLimit) {
        await prisma.discoveryEmbeddingJob.update({ where: { id: job.id }, data: { status: 'PENDING' } });
        break;
      }
      const embedding = await createOpenAiEmbedding({ apiKey, input });
      const costMicrousd = estimatedCostMicroUsd(embedding.tokens);
      if (latestUsage.costMicrousd + costMicrousd > hardLimit) {
        await prisma.discoveryEmbeddingJob.update({ where: { id: job.id }, data: { status: 'PENDING' } });
        break;
      }
      await prisma.$transaction([
        prisma.discoveryEmbeddingJob.update({
          where: { id: job.id },
          data: {
            status: 'READY',
            modelVersion: embedding.model,
            inputHash: hash,
            vector: embedding.vector,
            inputTokens: embedding.tokens,
            costMicrousd,
            errorCode: null,
            processedAt: new Date(),
          },
        }),
        prisma.discoveryAiUsage.update({
          where: { periodKey: latestUsage.periodKey },
          data: {
            inputTokens: { increment: embedding.tokens },
            costMicrousd: { increment: costMicrousd },
            jobsComplete: { increment: 1 },
          },
        }),
      ]);
      processed += 1;
      spentMicrousd += costMicrousd;
    } catch (error) {
      console.error('[DISCOVERY EMBEDDING WORKER]', error);
      await prisma.$transaction([
        prisma.discoveryEmbeddingJob.update({
          where: { id: job.id },
          data: { status: 'FAILED', errorCode: openAiErrorMessage(error).slice(0, 128) },
        }),
        prisma.discoveryAiUsage.update({
          where: { periodKey: usage.periodKey },
          data: { jobsFailed: { increment: 1 } },
        }),
      ]);
      failed += 1;
    }
  }
  return { processed, skippedBudget: Math.max(0, cappedLimit - jobs.length), failed, spentMicrousd, periodKey: usage.periodKey };
}
