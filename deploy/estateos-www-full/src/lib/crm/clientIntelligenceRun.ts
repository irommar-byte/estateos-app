import { prisma } from '@/lib/prisma';
import { notifyAgencyClientAboutOffer } from '@/lib/agencyClientNotify';
import { refreshAgencyClientMatches } from '@/lib/agencyClientMatching';
import {
  intelligenceAdjustScore,
  learnFromFeedback,
  shouldPersistBalcony,
  summarizeTaste,
  type LearnedTaste,
} from '@/lib/crm/clientIntelligence';

const OFFER_SELECT = {
  id: true,
  title: true,
  description: true,
  city: true,
  district: true,
  street: true,
  price: true,
  area: true,
  rooms: true,
  hasBalcony: true,
  hasGarden: true,
  hasElevator: true,
  hasParking: true,
  isFurnished: true,
  floor: true,
} as const;

type OfferRow = {
  id: number;
  title: string | null;
  description: string | null;
  city: string | null;
  district: string | null;
  street: string | null;
  price: number | null;
  area: number | null;
  rooms: number | null;
  hasBalcony: boolean | null;
  hasGarden: boolean | null;
  hasElevator: boolean | null;
  hasParking: boolean | null;
  isFurnished: boolean | null;
  floor: number | string | null;
};

export type IntelligencePick = {
  ready: boolean;
  skipReason: string | null;
  tasteSummary: string;
  learnCount: number;
  offerId: number | null;
  title: string | null;
  city: string | null;
  district: string | null;
  price: number | null;
  area: number | null;
  score: number | null;
  radarScore: number | null;
  reasons: string[];
  analysis: string[];
  considered: number;
  nextSendAt: string | null;
  correctedBalconyIds: number[];
};

function due(lastSentAt: Date | null, intervalHours: number): boolean {
  if (!lastSentAt) return true;
  return Date.now() - lastSentAt.getTime() >= intervalHours * 60 * 60 * 1000;
}

function nextSendAtIso(lastSentAt: Date | null, intervalHours: number, canSend: boolean): string | null {
  if (!canSend) return null;
  if (!lastSentAt) return new Date().toISOString();
  const dueAt = new Date(lastSentAt.getTime() + intervalHours * 60 * 60 * 1000);
  return (dueAt.getTime() > Date.now() ? dueAt : new Date()).toISOString();
}

async function persistBalconiesFromDescription(offers: OfferRow[]): Promise<number[]> {
  const ids = [...new Set(offers.filter((offer) => shouldPersistBalcony(offer)).map((offer) => offer.id))];
  if (!ids.length) return [];
  await prisma.offer.updateMany({ where: { id: { in: ids } }, data: { hasBalcony: true } });
  for (const offer of offers) {
    if (ids.includes(offer.id)) offer.hasBalcony = true;
  }
  return ids;
}

function buildAnalysis(params: {
  tasteSummary: string;
  radarScore: number;
  score: number;
  reasons: string[];
  considered: number;
  minScore: number;
  correctedBalcony: boolean;
}): string[] {
  const lines = [
    `Radar dał ${params.radarScore}% względem ankiety klienta.`,
    `Po nauce z reakcji pewność tej oferty to ${params.score}% (próg ${params.minScore}%).`,
    params.tasteSummary ? `Dotychczasowa nauka: ${params.tasteSummary}.` : null,
    params.correctedBalcony
      ? 'Opis wymienia balkon albo loggię, a w parametrach było pusto — parametr balkonu zostaje zaznaczony, żeby kolejne scoringi tego nie gubiły.'
      : null,
    ...params.reasons,
    `Spośród ${params.considered} niewysłanych trafień radaru to najwyższy wynik.`,
  ].filter(Boolean) as string[];
  return [...new Set(lines)];
}

export async function pickIntelligenceOffer(
  clientId: number,
  options: { force?: boolean; preview?: boolean } = {},
): Promise<{ pick: IntelligencePick; taste: LearnedTaste; agencyUserId: number; maxPrice: number | null }> {
  const client = await prisma.agencyClient.findUnique({
    where: { id: clientId },
    include: {
      buyerPreference: true,
      matches: {
        include: { offer: { select: OFFER_SELECT } },
        orderBy: { score: 'desc' },
      },
    },
  });

  const empty = (
    skipReason: string,
    extras: Partial<IntelligencePick> = {},
    taste = learnFromFeedback([]),
  ): IntelligencePick => ({
    ready: false,
    skipReason,
    tasteSummary: extras.tasteSummary ?? summarizeTaste(taste),
    learnCount: extras.learnCount ?? taste.learnCount,
    offerId: extras.offerId ?? null,
    title: extras.title ?? null,
    city: extras.city ?? null,
    district: extras.district ?? null,
    price: extras.price ?? null,
    area: extras.area ?? null,
    score: extras.score ?? null,
    radarScore: extras.radarScore ?? null,
    reasons: extras.reasons ?? [],
    analysis: extras.analysis || [],
    considered: extras.considered || 0,
    nextSendAt: extras.nextSendAt || null,
    correctedBalconyIds: extras.correctedBalconyIds || [],
  });

  if (!client || !client.buyerPreference) {
    return {
      agencyUserId: client?.agencyUserId || 0,
      maxPrice: null,
      taste: learnFromFeedback([]),
      pick: empty('Brak kryteriów radaru.'),
    };
  }

  const taste = learnFromFeedback(
    client.matches.map((row) => ({
      offerId: row.offerId,
      clientFeedback: row.clientFeedback,
      offer: row.offer,
    })),
  );

  const minLearns = client.intelligenceMinLearns || 3;
  const minScore = client.intelligenceMinScore || 92;
  const intervalHours = client.intelligenceIntervalHours || 24;
  const enabled = Boolean(client.intelligenceEnabled);

  if (!options.preview) {
    await refreshAgencyClientMatches(clientId);
  }

  const matches = options.preview
    ? client.matches
    : await prisma.agencyClientMatch.findMany({
        where: { clientId },
        include: { offer: { select: OFFER_SELECT } },
        orderBy: { score: 'desc' },
        take: 80,
      });

  const offers = matches.map((row) => row.offer);
  const correctedBalconyIds = await persistBalconiesFromDescription(offers);

  type Cand = {
    offerId: number;
    title: string;
    city: string | null;
    district: string | null;
    price: number | null;
    area: number | null;
    score: number;
    radarScore: number;
    reasons: string[];
  };
  let best: Cand | null = null;
  let considered = 0;
  for (const row of matches) {
    if (row.notifiedAt || row.sharedAt) continue;
    if (taste.rejectedOfferIds.includes(row.offerId)) continue;
    considered += 1;
    const radarScore = row.score;
    const adjusted = intelligenceAdjustScore({
      radarScore,
      offer: row.offer,
      taste,
      maxPrice: client.buyerPreference.maxPrice,
    });
    if (adjusted.score < minScore && !options.force && !options.preview) continue;
    if (!best || adjusted.score > best.score) {
      best = {
        offerId: row.offerId,
        title: String(row.offer.title || ''),
        city: row.offer.city,
        district: row.offer.district,
        price: row.offer.price,
        area: row.offer.area,
        score: adjusted.score,
        radarScore,
        reasons: adjusted.reasons,
      };
    }
  }

  let skipReason: string | null = null;
  if (!enabled && !options.force) skipReason = 'Asystent wyłączony — włącz, żeby wysyłał sam.';
  else if (taste.learnCount < minLearns && !options.force) {
    skipReason = `Za mało nauki (${taste.learnCount}/${minLearns} reakcji).`;
  } else if (!due(client.intelligenceLastSentAt, intervalHours) && !options.force) {
    skipReason = 'Interwał jeszcze nie minął.';
  } else if (!best) {
    skipReason = 'Brak oferty z wystarczającą pewnością.';
  } else if (best.score < minScore && !options.force) {
    skipReason = `Najlepsza oferta ma ${best.score}%, a próg to ${minScore}%.`;
  }

  const canSchedule = enabled && taste.learnCount >= minLearns;
  const qualifies = Boolean(best && (best.score >= minScore || options.force));
  const nextSendAt = nextSendAtIso(client.intelligenceLastSentAt, intervalHours, canSchedule && qualifies);
  const ready = !skipReason && qualifies;

  if (!best) {
    return {
      agencyUserId: client.agencyUserId,
      maxPrice: client.buyerPreference.maxPrice,
      taste,
      pick: empty(skipReason || 'Brak oferty z wystarczającą pewnością.', {
        tasteSummary: summarizeTaste(taste),
        learnCount: taste.learnCount,
        considered,
        nextSendAt,
        correctedBalconyIds,
      }, taste),
    };
  }

  const analysis = buildAnalysis({
    tasteSummary: summarizeTaste(taste),
    radarScore: best.radarScore,
    score: best.score,
    reasons: best.reasons,
    considered,
    minScore,
    correctedBalcony: correctedBalconyIds.includes(best.offerId),
  });

  return {
    agencyUserId: client.agencyUserId,
    maxPrice: client.buyerPreference.maxPrice,
    taste,
    pick: {
      ready,
      skipReason: ready ? null : skipReason,
      tasteSummary: summarizeTaste(taste),
      learnCount: taste.learnCount,
      offerId: best.offerId,
      title: best.title,
      city: best.city,
      district: best.district,
      price: best.price,
      area: best.area,
      score: best.score,
      radarScore: best.radarScore,
      reasons: best.reasons,
      analysis,
      considered,
      nextSendAt,
      correctedBalconyIds,
    },
  };
}

export async function sendIntelligenceOffer(params: {
  clientId: number;
  force?: boolean;
}): Promise<{ sent: boolean; pick: IntelligencePick; emailSent?: boolean }> {
  const { pick, agencyUserId } = await pickIntelligenceOffer(params.clientId, { force: params.force });
  if (!pick.ready || !pick.offerId || !agencyUserId) {
    return { sent: false, pick };
  }

  const reason = [`EstateOS™ Intelligence · pewność ${pick.score}%`, pick.tasteSummary, ...pick.analysis]
    .filter(Boolean)
    .join('\n');

  const notified = await notifyAgencyClientAboutOffer({
    clientId: params.clientId,
    offerId: pick.offerId,
    agencyUserId,
    channel: 'email',
    customMessage:
      'EstateOS™ Intelligence wybrało tę ofertę w imieniu agenta, na podstawie Twoich wcześniejszych reakcji.',
    intelligence: { reason },
  });

  await prisma.agencyClient.update({
    where: { id: params.clientId },
    data: { intelligenceLastSentAt: new Date() },
  });

  return { sent: true, pick, emailSent: notified.emailSent };
}

export async function tickClientIntelligence(): Promise<{
  scanned: number;
  sent: number;
  skipped: number;
}> {
  const clients = await prisma.agencyClient.findMany({
    where: { status: 'ACTIVE', intelligenceEnabled: true, buyerPreference: { isNot: null } },
    select: { id: true, intelligenceDailyLimit: true },
  });
  let sent = 0;
  let skipped = 0;
  for (const client of clients) {
    const limit = Math.max(1, Math.min(3, client.intelligenceDailyLimit || 1));
    let sentForClient = 0;
    for (let i = 0; i < limit; i += 1) {
      const result = await sendIntelligenceOffer({ clientId: client.id });
      if (result.sent) {
        sent += 1;
        sentForClient += 1;
      } else {
        skipped += 1;
        break;
      }
    }
    if (!sentForClient) skipped += 1;
  }
  return { scanned: clients.length, sent, skipped };
}
