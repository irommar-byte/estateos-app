import { prisma } from '@/lib/prisma';
import { notifyAgencyClientAboutOffer, remindPendingClientFeedback } from '@/lib/agencyClientNotify';
import { refreshAgencyClientMatches } from '@/lib/agencyClientMatching';
import { listInactiveImportedOfferIds, refreshOfferSourceStatusIfStale } from '@/lib/offerPrivateNotes';
import {
  clientFacingWhyLine,
  intelligenceAdjustScore,
  learnFromFeedback,
  parseIntelligenceLocks,
  preferenceUpdatesFromTaste,
  shouldPersistBalcony,
  summarizeTaste,
  buildIntelligenceLessons,
  type IntelligenceLesson,
  type LearnedTaste,
} from '@/lib/crm/clientIntelligence';
import { parseClientOfferFeedback } from '@/lib/crm/clientPortalFeedback';
import { buildOfferDialogueTurn } from '@/lib/crm/intelligenceDialogue';
import { clientAcceptsScarceBudget, getPendingCheckback } from '@/lib/crm/intelligenceCheckback';
import { sendPortalChat } from '@/lib/crm/portalChat';
import { resolveSellerPersonName } from '@/lib/sellerDisplay';

function lastFeedbackLesson(
  matches: Array<{
    offerId: number;
    clientFeedback: string | null;
    clientFeedbackAt?: Date | string | null;
    offer: OfferRow;
  }>,
): { prevOffer: OfferRow; prevFeedbackRaw: string } | null {
  const withFeedback = matches
    .filter((row) => row.clientFeedback)
    .map((row) => ({
      row,
      at: row.clientFeedbackAt ? new Date(row.clientFeedbackAt).getTime() : 0,
    }))
    .sort((a, b) => b.at - a.at);
  for (const { row } of withFeedback) {
    const parsed = parseClientOfferFeedback(row.clientFeedback);
    if (!parsed.sentiment && !parsed.phrases.length && !parsed.note) continue;
    return { prevOffer: row.offer, prevFeedbackRaw: row.clientFeedback! };
  }
  return null;
}

function agentFirstNameFromUser(user: { name?: string | null } | null | undefined): string | null {
  const full = resolveSellerPersonName(user) || user?.name || '';
  const first = full.trim().split(/\s+/)[0];
  return first || null;
}

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
  yearBuilt: true,
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
  yearBuilt: number | null;
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
  calibrating: boolean;
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
  clientWhy: string | null;
  lessons: IntelligenceLesson[];
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

/** Bez zapisu w bazie — import + radar biorą balkon z opisu; tu tylko informacja w kolejce. */
function overlayBalconyIds(offers: OfferRow[]): number[] {
  return [...new Set(offers.filter((offer) => shouldPersistBalcony(offer)).map((offer) => offer.id))];
}

let locksColumnReady = false;

export async function ensureIntelligenceLockedFieldsColumn(): Promise<void> {
  if (locksColumnReady) return;
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`AgencyClient\` ADD COLUMN \`intelligenceLockedFields\` JSON NULL`,
    );
    locksColumnReady = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Duplicate column|exists/i.test(message)) {
      locksColumnReady = true;
      return;
    }
    throw error;
  }
}

/** Zapisuje naukę z reakcji i odświeża kolejkę — bez wysyłki. */
export async function applyIntelligenceLearning(clientId: number): Promise<void> {
  await pickIntelligenceOffer(clientId, { preview: false });
}

function buildAnalysis(params: {
  tasteSummary: string;
  radarScore: number;
  score: number;
  reasons: string[];
  considered: number;
  minScore: number;
  correctedBalcony: boolean;
  calibrating: boolean;
}): string[] {
  const lines = [
    `Radar dał ${params.radarScore}% względem ankiety klienta.`,
    params.calibrating
      ? `Kalibracja: brak jeszcze reakcji, więc wysyłam najlepsze z radaru do oceny (próg ${params.minScore}% chwilowo nie blokuje).`
      : `Po nauce z reakcji pewność tej oferty to ${params.score}% (próg ${params.minScore}%).`,
    params.tasteSummary ? `Dotychczasowa nauka: ${params.tasteSummary}.` : null,
    params.correctedBalcony
      ? 'Opis wymienia balkon albo loggię, choć parametr był pusty — scoring i radar i tak to widzą.'
      : null,
    ...params.reasons,
    `Spośród ${params.considered} niewysłanych trafień radaru to najwyższy wynik.`,
  ].filter(Boolean) as string[];
  return [...new Set(lines)];
}

function emptyIntelligencePick(
  skipReason: string,
  extras: Partial<IntelligencePick> = {},
  taste = learnFromFeedback([]),
): IntelligencePick {
  return {
    ready: false,
    skipReason,
    tasteSummary: extras.tasteSummary ?? summarizeTaste(taste),
    learnCount: extras.learnCount ?? taste.learnCount,
    calibrating: extras.calibrating ?? false,
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
    clientWhy: extras.clientWhy ?? null,
    lessons: extras.lessons || [],
  };
}

export async function pickIntelligenceOffer(
  clientId: number,
  options: {
    force?: boolean;
    forceScore?: boolean;
    preview?: boolean;
    ignoreInterval?: boolean;
    excludeOfferIds?: number[];
    portalSupplyAttempted?: boolean;
    replyToFeedback?: boolean;
  } = {},
): Promise<{ pick: IntelligencePick; taste: LearnedTaste; agencyUserId: number; maxPrice: number | null; agentFirstName: string | null }> {
  await ensureIntelligenceLockedFieldsColumn();

  const client = await prisma.agencyClient.findUnique({
    where: { id: clientId },
    include: {
      buyerPreference: true,
      agencyUser: { select: { name: true, companyName: true } },
      matches: {
        include: { offer: { select: OFFER_SELECT } },
        orderBy: { score: 'desc' },
      },
    },
  });

  const empty = emptyIntelligencePick;

  if (!client || !client.buyerPreference) {
    return {
      agencyUserId: client?.agencyUserId || 0,
      maxPrice: null,
      taste: learnFromFeedback([]),
      agentFirstName: null,
      pick: empty('Brak kryteriów radaru.'),
    };
  }

  const agentFirstName = agentFirstNameFromUser(client.agencyUser);
  const acceptScarceBudget = await clientAcceptsScarceBudget(clientId);

  const taste = learnFromFeedback(
    client.matches.map((row) => ({
      offerId: row.offerId,
      clientFeedback: row.clientFeedback,
      offer: row.offer,
      clientFeedbackAt: row.clientFeedbackAt,
    })),
  );

  const minLearns = client.intelligenceMinLearns || 3;
  const minScore = client.intelligenceMinScore || 92;
  const intervalHours = client.intelligenceIntervalHours || 24;
  const enabled = Boolean(client.intelligenceEnabled);
  const calibrating = enabled && taste.learnCount === 0;
  const locks = parseIntelligenceLocks(client.intelligenceLockedFields, client.buyerPreference);

  if (!options.preview) {
    const writeback = preferenceUpdatesFromTaste({
      pref: client.buyerPreference,
      taste,
      locks,
    });
    if (writeback.notes.length) {
      await prisma.agencyClientActivity.create({
        data: {
          clientId,
          agencyUserId: client.agencyUserId,
          kind: 'INTELLIGENCE_TASTE',
          title: 'EstateOS™ Intelligence — nauka z reakcji',
          body: writeback.notes.join('\n'),
          metadata: { notes: writeback.notes, locks, pendingConfirm: true },
        },
      });
    }
  }

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
  const correctedBalconyIds = overlayBalconyIds(offers);

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
  const deadSourceIds = await listInactiveImportedOfferIds(matches.map((row) => row.offerId));
  const excluded = new Set(options.excludeOfferIds || []);
  let best: Cand | null = null;
  let considered = 0;
  const relaxScore = Boolean(options.preview || calibrating);
  for (const row of matches) {
    if (row.notifiedAt || row.sharedAt) continue;
    if (taste.rejectedOfferIds.includes(row.offerId)) continue;
    if (excluded.has(row.offerId) || deadSourceIds.has(row.offerId)) continue;
    considered += 1;
    const radarScore = row.score;
    const adjusted = intelligenceAdjustScore({
      radarScore,
      offer: row.offer,
      taste,
      maxPrice: client.buyerPreference.maxPrice,
      acceptScarceBudget,
      pref: {
        minYear: client.buyerPreference.minYear,
        minRooms: client.buyerPreference.minRooms,
        maxArea: client.buyerPreference.maxArea,
        minArea: client.buyerPreference.minArea,
      },
    });
    const passesStructural = adjusted.score > 0;
    if (!passesStructural) continue;
    if (adjusted.score < minScore && !relaxScore) continue;
    const cheaperTie =
      best &&
      adjusted.score === best.score &&
      radarScore === best.radarScore &&
      Number(row.offer.price || 0) < Number(best.price || 0);
    const better =
      !best ||
      adjusted.score > best.score ||
      (adjusted.score === best.score && radarScore > best.radarScore) ||
      cheaperTie;
    if (better) {
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

  const bestId = best?.offerId;
  const nextOffer = bestId
    ? matches.find((row) => row.offerId === bestId)?.offer || null
    : null;
  const lessons = buildIntelligenceLessons(matches, nextOffer);

  if (!best && !options.preview && !options.portalSupplyAttempted && (enabled || options.force)) {
    const { autoSupplyClientFromNieruchomosciOnline } = await import('@/lib/crm/clientIntelligencePortalSupply');
    const supply = await autoSupplyClientFromNieruchomosciOnline({
      clientId,
      agencyUserId: client.agencyUserId,
    });
    if (supply.imported > 0) {
      return pickIntelligenceOffer(clientId, { ...options, portalSupplyAttempted: true });
    }
  }

  let skipReason: string | null = null;
  if (!enabled && !options.force) skipReason = 'Asystent wyłączony — włącz, żeby wysyłał sam.';
  else if (!calibrating && taste.learnCount < minLearns && !options.force) {
    skipReason = `Za mało nauki (${taste.learnCount}/${minLearns} reakcji).`;
  } else if (!options.ignoreInterval && !due(client.intelligenceLastSentAt, intervalHours) && !options.force) {
    skipReason = 'Interwał jeszcze nie minął.';
  } else if (!best) {
    skipReason = 'Brak oferty z wystarczającą pewnością.';
  } else if (!calibrating && best.score < minScore && !options.forceScore) {
    skipReason = `Najlepsza oferta ma ${best.score}%, a próg to ${minScore}%.`;
  }

  const canSchedule = enabled && (calibrating || taste.learnCount >= minLearns);
  const qualifies = Boolean(
    best && (calibrating || best.score >= minScore || options.forceScore),
  );
  const nextSendAt = nextSendAtIso(client.intelligenceLastSentAt, intervalHours, canSchedule && qualifies);
  const ready = !skipReason && qualifies;

  if (!best) {
    return {
      agencyUserId: client.agencyUserId,
      maxPrice: client.buyerPreference.maxPrice,
      taste,
      agentFirstName,
      pick: empty(skipReason || 'Brak oferty z wystarczającą pewnością.', {
        tasteSummary: summarizeTaste(taste),
        learnCount: taste.learnCount,
        calibrating,
        considered,
        nextSendAt,
        correctedBalconyIds,
        lessons,
      }, taste),
    };
  }

  const feedbackLesson = lastFeedbackLesson(
    matches.map((row) => ({
      offerId: row.offerId,
      clientFeedback: row.clientFeedback,
      clientFeedbackAt: row.clientFeedbackAt,
      offer: row.offer,
    })),
  );
  const dialogueWhy = buildOfferDialogueTurn({
    prevOffer: feedbackLesson?.prevOffer ?? null,
    prevFeedback: feedbackLesson ? parseClientOfferFeedback(feedbackLesson.prevFeedbackRaw) : null,
    nextOffer: nextOffer,
    reasons: best.reasons,
    city: best.city,
    district: best.district,
    calibrating,
    agentFirstName,
  }).body;
  const clientWhy = dialogueWhy || clientFacingWhyLine({
    reasons: best.reasons,
    city: best.city,
    district: best.district,
    calibrating,
  });

  const analysis = buildAnalysis({
    tasteSummary: summarizeTaste(taste),
    radarScore: best.radarScore,
    score: best.score,
    reasons: best.reasons,
    considered,
    minScore,
    correctedBalcony: correctedBalconyIds.includes(best.offerId),
    calibrating,
  });

  return {
    agencyUserId: client.agencyUserId,
    maxPrice: client.buyerPreference.maxPrice,
    taste,
    agentFirstName,
    pick: {
      ready,
      skipReason: ready ? null : skipReason,
      tasteSummary: summarizeTaste(taste),
      learnCount: taste.learnCount,
      calibrating,
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
      clientWhy,
      lessons,
    },
  };
}

export async function sendIntelligenceOffer(params: {
  clientId: number;
  force?: boolean;
  forceScore?: boolean;
  ignoreInterval?: boolean;
  replyToFeedback?: boolean;
  channel?: 'email' | 'manual';
}): Promise<{ sent: boolean; pick: IntelligencePick; emailSent?: boolean }> {
  const pendingCheckback = await getPendingCheckback(params.clientId);
  if (pendingCheckback) {
    const blocked = emptyIntelligencePick('Czekam na odpowiedź klienta na pytanie asystenta.', {
      tasteSummary: '',
      learnCount: 0,
      calibrating: false,
      considered: 0,
      nextSendAt: null,
      correctedBalconyIds: [],
      lessons: [],
    });
    return { sent: false, pick: blocked };
  }

  const excludeOfferIds: number[] = [];
  let lastPick: IntelligencePick | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { pick, agencyUserId } = await pickIntelligenceOffer(params.clientId, {
      force: params.force,
      forceScore: params.forceScore,
      ignoreInterval: params.ignoreInterval ?? params.replyToFeedback,
      replyToFeedback: params.replyToFeedback,
      excludeOfferIds,
    });
    lastPick = pick;
    if (!pick.ready || !pick.offerId || !agencyUserId) {
      return { sent: false, pick };
    }

    const clientRow = await prisma.agencyClient.findUnique({
      where: { id: params.clientId },
      select: { intelligenceMinScore: true },
    });
    const minScore = clientRow?.intelligenceMinScore || 92;
    if (!pick.calibrating && (pick.score ?? 0) < minScore && !params.forceScore) {
      return {
        sent: false,
        pick: {
          ...pick,
          ready: false,
          skipReason: `Oferta ma ${pick.score}%, a próg to ${minScore}%.`,
        },
      };
    }

    const offer = await prisma.offer.findUnique({
      where: { id: pick.offerId },
      select: { userId: true },
    });
    if (offer?.userId) {
      const source = await refreshOfferSourceStatusIfStale(pick.offerId, offer.userId, {
        maxAgeMs: 12 * 60 * 60 * 1000,
      });
      if (source?.importExternalUrl && source.sourceIsActive === 0) {
        excludeOfferIds.push(pick.offerId);
        continue;
      }
    }

    const reason = [`EstateOS™ Intelligence · pewność ${pick.score}%`, pick.tasteSummary, ...pick.analysis]
      .filter(Boolean)
      .join('\n');

    const customMessage =
      pick.clientWhy ||
      clientFacingWhyLine({
        reasons: pick.reasons,
        city: pick.city,
        district: pick.district,
        calibrating: pick.calibrating,
      });

    const notified = await notifyAgencyClientAboutOffer({
      clientId: params.clientId,
      offerId: pick.offerId,
      agencyUserId,
      channel: params.channel ?? 'email',
      matchScore: pick.radarScore ?? undefined,
      customMessage,
      intelligence: { reason },
    });

    await sendPortalChat({
      clientId: params.clientId,
      agencyUserId,
      from: 'agent',
      content: customMessage,
    }).catch(() => {});

    await prisma.agencyClient.update({
      where: { id: params.clientId },
      data: { intelligenceLastSentAt: new Date() },
    });

    return { sent: true, pick, emailSent: notified.emailSent };
  }

  return {
    sent: false,
    pick: lastPick || {
      ready: false,
      skipReason: 'Źródła na portalach wygasły — brak żywej oferty do wysyłki.',
      tasteSummary: '',
      learnCount: 0,
      calibrating: false,
      offerId: null,
      title: null,
      city: null,
      district: null,
      price: null,
      area: null,
      score: null,
      radarScore: null,
      reasons: [],
      analysis: [],
      considered: 0,
      nextSendAt: null,
      correctedBalconyIds: [],
      clientWhy: null,
      lessons: [],
    },
  };
}

export async function tickClientIntelligence(): Promise<{
  scanned: number;
  sent: number;
  skipped: number;
  reminded: number;
}> {
  await ensureIntelligenceLockedFieldsColumn();
  const clients = await prisma.agencyClient.findMany({
    where: { status: 'ACTIVE', intelligenceEnabled: true, buyerPreference: { isNot: null } },
    select: { id: true, agencyUserId: true, intelligenceDailyLimit: true, intelligenceLastSentAt: true },
  });
  let sent = 0;
  let skipped = 0;
  for (const client of clients) {
    const pending = await getPendingCheckback(client.id);
    if (pending) {
      skipped += 1;
      continue;
    }
    const preview = await pickIntelligenceOffer(client.id, { preview: true });
    if (
      preview.pick.offerId &&
      preview.pick.skipReason === 'Interwał jeszcze nie minął.' &&
      preview.pick.nextSendAt
    ) {
      const since = client.intelligenceLastSentAt || new Date(0);
      const planned = await prisma.agencyClientActivity.findFirst({
        where: { clientId: client.id, kind: 'INTELLIGENCE_PLANNED', createdAt: { gte: since } },
        select: { id: true },
      });
      if (!planned) {
        await prisma.agencyClientActivity.create({
          data: {
            clientId: client.id,
            agencyUserId: client.agencyUserId,
            offerId: preview.pick.offerId,
            kind: 'INTELLIGENCE_PLANNED',
            title: `Plan: wyślę maila — ${preview.pick.title}`,
            body: [
              preview.pick.nextSendAt
                ? `Planowana wysyłka: ${new Date(preview.pick.nextSendAt).toLocaleString('pl-PL')}`
                : null,
              preview.pick.clientWhy,
            ]
              .filter(Boolean)
              .join('\n'),
            metadata: {
              offerId: preview.pick.offerId,
              nextSendAt: preview.pick.nextSendAt,
              score: preview.pick.score,
            },
          },
        });
      }
    }
    const limit = Math.max(1, Math.min(3, client.intelligenceDailyLimit || 1));
    let sentForClient = 0;
    for (let i = 0; i < limit; i += 1) {
      const result = await sendIntelligenceOffer({
        clientId: client.id,
        ignoreInterval: i > 0,
      });
      if (result.sent) {
        sent += 1;
        sentForClient += 1;
      } else {
        break;
      }
    }
    if (!sentForClient) skipped += 1;
  }
  const reminders = await remindPendingClientFeedback();
  return { scanned: clients.length, sent, skipped, reminded: reminders.reminded };
}
