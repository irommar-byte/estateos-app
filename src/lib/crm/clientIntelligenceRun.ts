import { prisma } from '@/lib/prisma';
import { notifyAgencyClientAboutOffer } from '@/lib/agencyClientNotify';
import { refreshAgencyClientMatches } from '@/lib/agencyClientMatching';
import {
  intelligenceAdjustScore,
  learnFromFeedback,
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

export type IntelligencePick = {
  ready: boolean;
  skipReason: string | null;
  tasteSummary: string;
  learnCount: number;
  offerId: number | null;
  title: string | null;
  score: number | null;
  radarScore: number | null;
  reasons: string[];
  considered: number;
};

function due(lastSentAt: Date | null, intervalHours: number): boolean {
  if (!lastSentAt) return true;
  return Date.now() - lastSentAt.getTime() >= intervalHours * 60 * 60 * 1000;
}

export async function pickIntelligenceOffer(
  clientId: number,
  options: { force?: boolean } = {},
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
  if (!client || !client.buyerPreference) {
    return {
      agencyUserId: client?.agencyUserId || 0,
      maxPrice: null,
      taste: learnFromFeedback([]),
      pick: {
        ready: false,
        skipReason: 'Brak kryteriów radaru.',
        tasteSummary: '',
        learnCount: 0,
        offerId: null,
        title: null,
        score: null,
        radarScore: null,
        reasons: [],
        considered: 0,
      },
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
  const empty = (skipReason: string): IntelligencePick => ({
    ready: false,
    skipReason,
    tasteSummary: summarizeTaste(taste),
    learnCount: taste.learnCount,
    offerId: null,
    title: null,
    score: null,
    radarScore: null,
    reasons: [],
    considered: 0,
  });

  if (!options.force && !client.intelligenceEnabled) {
    return { agencyUserId: client.agencyUserId, maxPrice: client.buyerPreference.maxPrice, taste, pick: empty('Asystent wyłączony.') };
  }
  if (!options.force && taste.learnCount < minLearns) {
    return {
      agencyUserId: client.agencyUserId,
      maxPrice: client.buyerPreference.maxPrice,
      taste,
      pick: empty(`Za mało nauki (${taste.learnCount}/${minLearns}).`),
    };
  }
  if (!options.force && !due(client.intelligenceLastSentAt, client.intelligenceIntervalHours || 24)) {
    return { agencyUserId: client.agencyUserId, maxPrice: client.buyerPreference.maxPrice, taste, pick: empty('Interwał jeszcze nie minął.') };
  }

  await refreshAgencyClientMatches(clientId);
  const matches = await prisma.agencyClientMatch.findMany({
    where: { clientId },
    include: { offer: { select: OFFER_SELECT } },
    orderBy: { score: 'desc' },
    take: 80,
  });

  let best: { offerId: number; title: string; score: number; radarScore: number; reasons: string[] } | null = null;
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
    if (adjusted.score < minScore && !options.force) continue;
    if (!best || adjusted.score > best.score) {
      best = {
        offerId: row.offerId,
        title: String(row.offer.title || ''),
        score: adjusted.score,
        radarScore,
        reasons: adjusted.reasons,
      };
    }
  }

  if (!best) {
    return {
      agencyUserId: client.agencyUserId,
      maxPrice: client.buyerPreference.maxPrice,
      taste,
      pick: { ...empty('Brak oferty z wystarczającą pewnością.'), considered },
    };
  }

  return {
    agencyUserId: client.agencyUserId,
    maxPrice: client.buyerPreference.maxPrice,
    taste,
    pick: {
      ready: true,
      skipReason: null,
      tasteSummary: summarizeTaste(taste),
      learnCount: taste.learnCount,
      offerId: best.offerId,
      title: best.title,
      score: best.score,
      radarScore: best.radarScore,
      reasons: best.reasons,
      considered,
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

  const reason = [
    `EstateOS™ Intelligence · pewność ${pick.score}%`,
    pick.tasteSummary,
    ...pick.reasons,
  ]
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
