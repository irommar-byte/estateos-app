import { prisma } from '@/lib/prisma';
import {
  learnFromFeedback,
  parseIntelligenceLocks,
  buildCheckbackPreferenceUpdate,
  type IntelligenceLockKey,
  type IntelligenceLocks,
  type LearnedTaste,
} from '@/lib/crm/clientIntelligence';
import { shouldTriggerMarketRealityCheckback } from '@/lib/crm/buyerMarketReality';
import {
  buildConfidenceDialogueTurn,
  buildMarketRealityDialogueTurn,
  buildRelaxBalconyDialogueTurn,
  type DialogueTurn,
  type CheckbackOption,
} from '@/lib/crm/intelligenceDialogue';
import { sendPortalChat } from '@/lib/crm/portalChat';
import { ensureIntelligenceLockedFieldsColumn } from '@/lib/crm/clientIntelligenceRun';

export const INTELLIGENCE_ACTIVITY = {
  CHECKBACK: 'INTELLIGENCE_CHECKBACK',
  HANDOFF: 'INTELLIGENCE_HANDOFF',
} as const;

export type CheckbackStatus = 'pending' | 'accepted' | 'rejected';

export type PendingCheckback = {
  activityId: number;
  type: string;
  body: string;
  options: CheckbackOption[];
  marketSnapshot?: Record<string, unknown> | null;
  lockKey?: IntelligenceLockKey | null;
  createdAt: string;
};

const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const CONFIRM_PHRASES = [
  'Za drogo',
  'Brak balkonu',
  'Nie ta dzielnica',
  'Za stare',
  'Za mało pokoi',
  'Brak parkingu',
  'Brak windy',
  'Brak ogrodu',
  'Za mały metraż',
  'Za duży metraż',
] as const;

export { CONFIRM_PHRASES as INTELLIGENCE_CONFIRM_PHRASES };

function phraseCount(taste: LearnedTaste, phrase: string): number {
  return taste.phrases.filter((item) => item === phrase).length;
}

function meta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export async function getPendingCheckback(clientId: number): Promise<PendingCheckback | null> {
  const row = await prisma.agencyClientActivity.findFirst({
    where: { clientId, kind: INTELLIGENCE_ACTIVITY.CHECKBACK },
    orderBy: { createdAt: 'desc' },
    select: { id: true, body: true, createdAt: true, metadata: true },
  });
  if (!row) return null;
  const m = meta(row.metadata);
  if (m.status !== 'pending') return null;
  return {
    activityId: row.id,
    type: String(m.type || ''),
    body: row.body || '',
    options: Array.isArray(m.options) ? (m.options as CheckbackOption[]) : [],
    marketSnapshot: (m.marketSnapshot as PendingCheckback['marketSnapshot']) || null,
    lockKey: (m.lockKey as IntelligenceLockKey) || null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function isOnCooldown(clientId: number, type: string): Promise<boolean> {
  const since = new Date(Date.now() - COOLDOWN_MS);
  const recent = await prisma.agencyClientActivity.findFirst({
    where: {
      clientId,
      kind: INTELLIGENCE_ACTIVITY.CHECKBACK,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true },
  });
  if (!recent) return false;
  const m = meta(recent.metadata);
  return m.type === type && m.status === 'rejected';
}

export async function clientAcceptsScarceBudget(clientId: number): Promise<boolean> {
  const row = await prisma.agencyClientActivity.findFirst({
    where: { clientId, kind: INTELLIGENCE_ACTIVITY.CHECKBACK },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true },
  });
  const m = meta(row?.metadata);
  return m.type === 'market_reality' && m.status === 'accepted' && m.optionId === 'stay_budget';
}

async function countCounterfactualWithoutBalcony(clientId: number, minThreshold: number): Promise<number> {
  return prisma.agencyClientMatch.count({
    where: {
      clientId,
      notifiedAt: null,
      sharedAt: null,
      score: { gte: minThreshold },
      offer: { hasBalcony: false },
    },
  });
}

async function intelligenceSearchMaturity(clientId: number): Promise<{ rejectCount: number; daysSinceFirstSend: number }> {
  const [dislikes, firstSend] = await Promise.all([
    prisma.agencyClientMatch.count({
      where: { clientId, clientFeedback: { contains: '"dislike"' } },
    }),
    prisma.agencyClientActivity.findFirst({
      where: { clientId, kind: { in: ['INTELLIGENCE_OFFER', 'CLIENT_NOTIFIED', 'OFFER_SHARED'] } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ]);
  const daysSinceFirstSend = firstSend
    ? (Date.now() - firstSend.createdAt.getTime()) / (24 * 60 * 60 * 1000)
    : 0;
  return { rejectCount: dislikes, daysSinceFirstSend };
}

export async function detectExtremeCheckback(params: {
  clientId: number;
  agencyUserId: number;
  agentFirstName?: string | null;
}): Promise<DialogueTurn | null> {
  const client = await prisma.agencyClient.findUnique({
    where: { id: params.clientId },
    include: { buyerPreference: true, matches: { select: { clientFeedback: true, offerId: true, offer: true, clientFeedbackAt: true } } },
  });
  if (!client?.buyerPreference || !client.intelligenceEnabled) return null;

  const taste = learnFromFeedback(
    client.matches.map((row) => ({
      offerId: row.offerId,
      clientFeedback: row.clientFeedback,
      offer: row.offer,
      clientFeedbackAt: row.clientFeedbackAt,
    })),
  );
  const locks = parseIntelligenceLocks(client.intelligenceLockedFields, client.buyerPreference);
  const pref = client.buyerPreference;
  const minLearns = client.intelligenceMinLearns || 3;
  if (taste.learnCount < minLearns) return null;

  const market = await shouldTriggerMarketRealityCheckback({
    city: pref.city,
    districts: pref.districts,
    maxPrice: pref.maxPrice,
    minArea: pref.minArea,
    taste,
  });
  if (market.trigger && market.snapshot && !(await isOnCooldown(params.clientId, 'market_reality'))) {
    return buildMarketRealityDialogueTurn({ snapshot: market.snapshot, agentFirstName: params.agentFirstName });
  }

  const requireBalcony = Boolean(pref.requireBalcony || locks.requireBalcony);
  if (requireBalcony && !(await isOnCooldown(params.clientId, 'relax_requireBalcony'))) {
    const maturity = await intelligenceSearchMaturity(params.clientId);
    if (maturity.rejectCount >= 5 || maturity.daysSinceFirstSend >= 7) {
      const threshold = pref.minMatchThreshold ?? 70;
      const counter = await countCounterfactualWithoutBalcony(params.clientId, threshold);
      if (counter >= 1) {
        const preview = await import('@/lib/crm/clientIntelligenceRun').then((m) =>
          m.pickIntelligenceOffer(params.clientId, { preview: true }),
        );
        const stuck =
          !preview.pick.offerId ||
          Boolean(preview.pick.skipReason?.includes('Brak oferty')) ||
          Boolean(preview.pick.skipReason?.includes('próg'));
        if (stuck) {
          return buildRelaxBalconyDialogueTurn({
            agentFirstName: params.agentFirstName,
            rejectCount: maturity.rejectCount,
          });
        }
      }
    }
  }

  for (const phrase of CONFIRM_PHRASES) {
    const type = `confirm_${phrase.replace(/\s+/g, '_').toLowerCase()}`;
    if (phraseCount(taste, phrase) >= 2 && !(await isOnCooldown(params.clientId, type))) {
      return buildConfidenceDialogueTurn({ phrase, agentFirstName: params.agentFirstName });
    }
  }

  return null;
}

export async function createAndDeliverCheckback(params: {
  clientId: number;
  agencyUserId: number;
  turn: DialogueTurn;
}): Promise<{ activityId: number }> {
  const activity = await prisma.agencyClientActivity.create({
    data: {
      clientId: params.clientId,
      agencyUserId: params.agencyUserId,
      kind: INTELLIGENCE_ACTIVITY.CHECKBACK,
      title: 'Pytanie od asystenta',
      body: params.turn.body.slice(0, 2000),
      metadata: {
        type: params.turn.checkbackType,
        status: 'pending' satisfies CheckbackStatus,
        facts: params.turn.facts,
        options: params.turn.options || [],
        lockKey: params.turn.lockKey || null,
        marketSnapshot: params.turn.marketSnapshot || null,
      },
    },
    select: { id: true },
  });

  await sendPortalChat({
    clientId: params.clientId,
    agencyUserId: params.agencyUserId,
    from: 'agent',
    content: params.turn.body,
    checkbackQuickReplies: {
      activityId: activity.id,
      options: params.turn.options || [],
    },
  }).catch(() => {});

  return { activityId: activity.id };
}

function mergeLocks(current: unknown, pref: Parameters<typeof parseIntelligenceLocks>[1], patch: Partial<IntelligenceLocks>) {
  const base = parseIntelligenceLocks(current, pref);
  return { ...base, ...patch };
}

export async function respondToIntelligenceCheckback(params: {
  clientId: number;
  agencyUserId: number;
  activityId: number;
  optionId: string;
}): Promise<{ ok: boolean; error?: string; followUp?: 'send_offer' | 'none' }> {
  await ensureIntelligenceLockedFieldsColumn();
  const activity = await prisma.agencyClientActivity.findFirst({
    where: { id: params.activityId, clientId: params.clientId, kind: INTELLIGENCE_ACTIVITY.CHECKBACK },
  });
  if (!activity) return { ok: false, error: 'Nie znaleziono pytania.' };
  const m = meta(activity.metadata);
  if (m.status !== 'pending') return { ok: false, error: 'To pytanie zostało już rozstrzygnięte.' };

  const client = await prisma.agencyClient.findUnique({
    where: { id: params.clientId },
    include: { buyerPreference: true },
  });
  if (!client?.buyerPreference) return { ok: false, error: 'Brak ankiety.' };

  const type = String(m.type || '');
  const lockKey = m.lockKey as IntelligenceLockKey | undefined;
  const locks = parseIntelligenceLocks(client.intelligenceLockedFields, client.buyerPreference);
  const prefUpdate: Record<string, unknown> = {};
  let lockUpdate: Partial<IntelligenceLocks> | null = null;
  let agentNote: string | null = null;
  let followUp: 'send_offer' | 'none' = 'none';

  const accepted = !['no', 'keep_balcony'].includes(params.optionId);

  if (type === 'market_reality') {
    if (params.optionId === 'stay_budget') {
      /* flag stored in activity metadata */
    } else if (params.optionId === 'raise_budget') {
      const snap = m.marketSnapshot as { suggestedMaxPrice?: number } | null;
      const next = Number(snap?.suggestedMaxPrice);
      if (Number.isFinite(next) && next > 0) {
        if (locks.maxPrice) {
          agentNote = 'Klient chce iść bliżej rynku, ale budżet ma kłódkę — agent musi zatwierdzić.';
        } else {
          prefUpdate.maxPrice = next;
          lockUpdate = mergeLocks(client.intelligenceLockedFields, client.buyerPreference, { maxPrice: false });
          followUp = 'send_offer';
        }
      }
    }
  } else if (type === 'relax_requireBalcony') {
    if (params.optionId === 'allow_without_balcony') {
      prefUpdate.requireBalcony = false;
      lockUpdate = mergeLocks(client.intelligenceLockedFields, client.buyerPreference, { requireBalcony: false });
      followUp = 'send_offer';
    }
  } else if (type.startsWith('confirm_')) {
    if (params.optionId === 'yes') {
      const taste = learnFromFeedback(
        (
          await prisma.agencyClientMatch.findMany({
            where: { clientId: params.clientId },
            select: { offerId: true, clientFeedback: true, offer: true, clientFeedbackAt: true },
          })
        ).map((row) => ({
          offerId: row.offerId,
          clientFeedback: row.clientFeedback,
          offer: row.offer,
          clientFeedbackAt: row.clientFeedbackAt,
        })),
      );
      const confirmed = buildCheckbackPreferenceUpdate({
        checkbackType: type,
        taste,
        pref: client.buyerPreference,
        locks,
      });
      Object.assign(prefUpdate, confirmed.data);
      if (confirmed.lockPatch) {
        lockUpdate = mergeLocks(client.intelligenceLockedFields, client.buyerPreference, confirmed.lockPatch);
      }
      if (confirmed.agentNote) {
        agentNote = confirmed.agentNote;
      } else if (Object.keys(confirmed.data).length) {
        followUp = 'send_offer';
      } else if (type.includes('za_drogo')) {
        followUp = 'send_offer';
      }
    }
  }

  await prisma.$transaction([
    prisma.agencyClientActivity.update({
      where: { id: activity.id },
      data: {
        metadata: {
          ...m,
          status: accepted ? 'accepted' : 'rejected',
          optionId: params.optionId,
          respondedAt: new Date().toISOString(),
        },
      },
    }),
    ...(Object.keys(prefUpdate).length
      ? [
          prisma.agencyClientBuyerPreference.update({
            where: { clientId: params.clientId },
            data: prefUpdate,
          }),
        ]
      : []),
    ...(lockUpdate
      ? [
          prisma.agencyClient.update({
            where: { id: params.clientId },
            data: { intelligenceLockedFields: lockUpdate },
          }),
        ]
      : []),
    ...(agentNote
      ? [
          prisma.agencyClientActivity.create({
            data: {
              clientId: params.clientId,
              agencyUserId: params.agencyUserId,
              kind: INTELLIGENCE_ACTIVITY.HANDOFF,
              title: 'Asystent czeka na agenta',
              body: agentNote,
              metadata: { type, optionId: params.optionId, lockKey: lockKey || null },
            },
          }),
        ]
      : []),
  ]);

  const ack =
    params.optionId === 'no'
      ? 'Dzięki — poprawię zrozumienie. Możesz doprecyzować przy następnej ofercie.'
      : agentNote
        ? 'Zostaję przy ustaleniach z agentem — wróci z konkretem.'
        : 'Dzięki — biorę to pod uwagę i szukam dalej.';

  await sendPortalChat({
    clientId: params.clientId,
    agencyUserId: params.agencyUserId,
    from: 'agent',
    content: ack,
  }).catch(() => {});

  if (Object.keys(prefUpdate).length) {
    const { refreshAgencyClientMatches } = await import('@/lib/agencyClientMatching');
    await refreshAgencyClientMatches(params.clientId).catch(() => {});
  }

  return { ok: true, followUp: agentNote ? 'none' : followUp };
}

export function feedbackRequestsHandoff(feedback: { phrases: string[]; note: string; liked: string; disliked: string }): string | null {
  const blob = `${feedback.note} ${feedback.liked} ${feedback.disliked} ${feedback.phrases.join(' ')}`.toLowerCase();
  const normalized = blob
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l');
  if (
    /(oglad|prezentac|spotkan|zadzwon|telefon|umow|zobacz|chce zobaczyc|chce zobacz)/.test(normalized)
  ) {
    return 'Widzę, że chcesz przejść do oglądania albo rozmowy — przekazuję to agentowi.';
  }
  return null;
}
