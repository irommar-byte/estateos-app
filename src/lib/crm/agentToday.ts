import { prisma } from '@/lib/prisma';
import { buildBuyerAgentTasks } from '@/lib/crm/buyerAgentTasks';
import { INTELLIGENCE_APPROVAL_KIND } from '@/lib/crm/intelligenceApproval';
import { shapeAgencyClientMatchOffer } from '@/lib/crm/matchOfferShape';
import { fetchUpcomingScheduleEvents } from '@/lib/crm/upcomingScheduleEvents';
import { isSameWarsawDay } from '@/lib/crm/scheduleIdentity';
import { JOURNEY_ACTIVITY } from '@/lib/crm/clientJourney';
import { type TodayOwnerContact } from '@/lib/crm/ownerContact';
import { resolveOwnerContact } from '@/lib/crm/ownerContactLookup';
import { listPendingOutbox, type OutboxItem } from '@/lib/crm/clientOutbox';

/**
 * Ekran „Dziś” agenta: wszystko, co czeka na jego ruch, w kolejności pilności.
 * Jedno zapytanie z aplikacji zamiast przeglądania kart klientów.
 */

const FEEDBACK_WINDOW_DAYS = 30;
const MESSAGE_WINDOW_DAYS = 14;
const STALE_AFTER_DAYS = 7;
const STALE_MAX_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export type TodayOffer = {
  id: number;
  title: string;
  price: number | null;
  city: string | null;
  district: string | null;
  street: string | null;
  area: number | null;
  rooms: number | null;
  imageUrl: string;
};

export type { TodayOwnerContact } from '@/lib/crm/ownerContact';

export type TodayApproval = {
  approvalId: number;
  clientId: number;
  clientName: string;
  offer: TodayOffer | null;
  score: number | null;
  clientWhy: string | null;
  createdAt: string;
};

export type TodayOwnerCall = TodayApproval & {
  owner: TodayOwnerContact | null;
  lastOutcome: 'no_answer' | null;
  attempts: number;
};

export type TodayReply = {
  id: string;
  kind: 'viewing' | 'question' | 'handoff' | 'stalled' | 'message';
  clientId: number;
  clientName: string;
  title: string;
  body: string;
  createdAt: string;
  activityId: number | null;
  matchId: number | null;
  offerId: number | null;
  unreadCount?: number;
};

export type TodayScheduleItem = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  location: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
  clientId: number | null;
  offerId: number | null;
};

export type TodayStaleClient = {
  clientId: number;
  clientName: string;
  type: 'BUYER' | 'SELLER';
  phone: string | null;
  lastActivityAt: string;
  days: number;
};

export type AgentToday = {
  generatedAt: string;
  counts: {
    outbox: number;
    ownerCalls: number;
    approvals: number;
    replies: number;
    schedule: number;
    stale: number;
    total: number;
  };
  /** Wiadomości do klientów czekające na akceptację agenta. */
  outbox: OutboxItem[];
  ownerCalls: TodayOwnerCall[];
  approvals: TodayApproval[];
  replies: TodayReply[];
  schedule: TodayScheduleItem[];
  stale: TodayStaleClient[];
};

function record(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function fullName(client: { firstName: string; lastName: string } | null | undefined): string {
  if (!client) return 'Klient';
  return `${client.firstName} ${client.lastName}`.replace(/\s+/g, ' ').trim() || 'Klient';
}

function offerSummary(offer: Parameters<typeof shapeAgencyClientMatchOffer>[0] | null | undefined): TodayOffer | null {
  if (!offer) return null;
  const shaped = shapeAgencyClientMatchOffer(offer);
  return {
    id: shaped.id,
    title: shaped.title,
    price: shaped.price == null ? null : Number(shaped.price),
    city: shaped.city ?? null,
    district: shaped.district ?? null,
    street: shaped.street ?? null,
    area: shaped.area ?? null,
    rooms: shaped.rooms ?? null,
    imageUrl: shaped.imageUrl,
  };
}

const OFFER_FIELDS = {
  id: true,
  title: true,
  price: true,
  pricePln: true,
  priceCurrency: true,
  city: true,
  district: true,
  street: true,
  description: true,
  area: true,
  rooms: true,
  transactionType: true,
  propertyType: true,
  images: true,
  userId: true,
  status: true,
} as const;

export async function loadAgentToday(params: {
  agencyUserId: number;
  scheduleUserId: number;
  now?: Date;
}): Promise<AgentToday> {
  const now = params.now ?? new Date();
  const { agencyUserId } = params;

  const actor = await prisma.user.findUnique({ where: { id: agencyUserId }, select: { role: true } });
  const isAdmin = String(actor?.role || '').toUpperCase() === 'ADMIN';

  // ── 1+2. Propozycje asystenta czekające na agenta ─────────────────────────
  const approvalRows = await prisma.agencyClientActivity.findMany({
    where: {
      agencyUserId,
      kind: INTELLIGENCE_APPROVAL_KIND,
      createdAt: { gte: new Date(now.getTime() - 45 * DAY_MS) },
      client: { status: 'ACTIVE' },
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: {
      id: true,
      clientId: true,
      offerId: true,
      metadata: true,
      createdAt: true,
      client: { select: { firstName: true, lastName: true } },
    },
  });
  const pendingApprovals = approvalRows.filter((row) => {
    const meta = record(row.metadata);
    if (meta.status !== 'pending') return false;
    const snoozedUntil = meta.snoozedUntil ? new Date(String(meta.snoozedUntil)) : null;
    return !snoozedUntil || Number.isNaN(snoozedUntil.getTime()) || snoozedUntil.getTime() <= now.getTime();
  });
  const approvalOfferIds = [...new Set(pendingApprovals.map((row) => Number(row.offerId)).filter((id) => id > 0))];
  const approvalOffers = approvalOfferIds.length
    ? await prisma.offer.findMany({ where: { id: { in: approvalOfferIds } }, select: OFFER_FIELDS })
    : [];
  const offerById = new Map(approvalOffers.map((offer) => [offer.id, offer]));
  // Oferty zarchiwizowane przez nocne sprawdzanie portali (ogłoszenie zniknęło) — właściciel może nadal sprzedawać,
  // więc karta „Zadzwoń do właściciela” zostaje. Ręcznie zarchiwizowane / sprzedane odpadają.
  const archivedIds = approvalOffers.filter((offer) => offer.status === 'ARCHIVED').map((offer) => offer.id);
  const sourceArchived = new Set<number>();
  if (archivedIds.length) {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT offerId FROM OfferPrivateNote WHERE sourceArchivedAt IS NOT NULL AND offerId IN (${archivedIds.map(() => '?').join(',')})`,
      ...archivedIds,
    ).catch(() => [])) as Array<{ offerId: number }>;
    for (const row of rows) sourceArchived.add(Number(row.offerId));
  }
  let keiLookups = 0;

  const ownerCalls: TodayOwnerCall[] = [];
  const approvals: TodayApproval[] = [];
  for (const row of pendingApprovals) {
    const meta = record(row.metadata);
    const pick = record(meta.pick);
    const offer = row.offerId ? offerById.get(row.offerId) : undefined;
    // Oferta już nieaktywna w bazie (sprzedana / zarchiwizowana ręcznie) — nie zawracamy nią głowy.
    const archivedBySourceCheck = Boolean(offer && offer.status === 'ARCHIVED' && sourceArchived.has(offer.id));
    if (offer && offer.status !== 'ACTIVE' && !archivedBySourceCheck) continue;
    const base: TodayApproval = {
      approvalId: row.id,
      clientId: row.clientId,
      clientName: fullName(row.client),
      offer: offerSummary(offer) ?? (pick.title ? {
        id: Number(row.offerId) || 0,
        title: String(pick.title),
        price: pick.price == null ? null : Number(pick.price),
        city: pick.city ? String(pick.city) : null,
        district: pick.district ? String(pick.district) : null,
        street: null,
        area: pick.area == null ? null : Number(pick.area),
        rooms: null,
        imageUrl: '',
      } : null),
      score: pick.score == null ? null : Number(pick.score),
      clientWhy: pick.clientWhy ? String(pick.clientWhy) : null,
      createdAt: row.createdAt.toISOString(),
    };
    const expired = Boolean(meta.sourceExpired || pick.sourceExpired || archivedBySourceCheck);
    if (!expired) {
      approvals.push(base);
      continue;
    }
    let owner: TodayOwnerContact | null = null;
    if (offer) {
      // Numer właściciela widzi agent prowadzący, jego biuro i administrator; pozostali dostają numer agenta prowadzącego.
      // Brak numeru w imporcie → szukamy w KEI na żywo (maks. 2 oferty na jedno otwarcie ekranu, wynik zapamiętany).
      owner = await resolveOwnerContact({
        offer,
        viewerId: agencyUserId,
        isAdmin,
        allowKeiLookup: keiLookups < 2,
      }).catch(() => null);
      if (owner && !owner.phone && !owner.listingAgent) keiLookups += 1;
    }
    const calls = Array.isArray(meta.ownerCalls) ? meta.ownerCalls : [];
    const last = record(calls[calls.length - 1]);
    ownerCalls.push({
      ...base,
      owner,
      lastOutcome: last.outcome === 'no_answer' ? 'no_answer' : null,
      attempts: calls.length,
    });
  }

  // ── 3. Odpowiedzi klientów ────────────────────────────────────────────────
  const taskActivities = await prisma.agencyClientActivity.findMany({
    where: {
      agencyUserId,
      kind: { in: ['CLIENT_FEEDBACK', 'INTELLIGENCE_HANDOFF', 'INTELLIGENCE_STALLED'] },
      createdAt: { gte: new Date(now.getTime() - FEEDBACK_WINDOW_DAYS * DAY_MS) },
      client: { status: 'ACTIVE', type: 'BUYER' },
    },
    orderBy: { createdAt: 'desc' },
    take: 400,
    select: { id: true, clientId: true, kind: true, title: true, body: true, offerId: true, createdAt: true, metadata: true },
  });
  const taskClientIds = [...new Set(taskActivities.map((row) => row.clientId))].slice(0, 60);
  const [taskClients, taskMatches] = taskClientIds.length
    ? await Promise.all([
        prisma.agencyClient.findMany({
          where: { id: { in: taskClientIds } },
          select: { id: true, firstName: true, lastName: true },
        }),
        prisma.agencyClientMatch.findMany({
          where: { clientId: { in: taskClientIds }, clientFeedbackAt: { not: null } },
          select: {
            id: true,
            clientId: true,
            clientFeedback: true,
            clientFeedbackAt: true,
            offer: { select: { id: true, title: true } },
          },
        }),
      ])
    : [[], []];
  const clientNameById = new Map(taskClients.map((client) => [client.id, fullName(client)]));
  const replies: TodayReply[] = [];
  for (const clientId of taskClientIds) {
    const tasks = buildBuyerAgentTasks(
      taskMatches.filter((match) => match.clientId === clientId),
      taskActivities.filter((activity) => activity.clientId === clientId),
    );
    for (const task of tasks) {
      replies.push({
        id: `${clientId}-${task.id}`,
        kind: task.kind,
        clientId,
        clientName: clientNameById.get(clientId) || 'Klient',
        title: task.title,
        body: task.body,
        createdAt: task.createdAt,
        activityId: task.activityId,
        matchId: task.matchId,
        offerId: task.offerId,
      });
    }
  }

  // Nieprzeczytane wiadomości z panelu klienta.
  const messageRows = await prisma.agencyClientActivity.findMany({
    where: {
      agencyUserId,
      kind: JOURNEY_ACTIVITY.PORTAL_MESSAGE,
      createdAt: { gte: new Date(now.getTime() - MESSAGE_WINDOW_DAYS * DAY_MS) },
      client: { status: 'ACTIVE' },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
    select: {
      id: true,
      clientId: true,
      body: true,
      createdAt: true,
      metadata: true,
      client: { select: { firstName: true, lastName: true, portalChatState: { select: { agentLastReadAt: true } } } },
    },
  });
  const unreadByClient = new Map<number, { count: number; latest: (typeof messageRows)[number] }>();
  for (const row of messageRows) {
    if (record(row.metadata).from !== 'client') continue;
    const readAt = row.client.portalChatState?.agentLastReadAt;
    if (readAt && row.createdAt.getTime() <= readAt.getTime()) continue;
    const current = unreadByClient.get(row.clientId);
    if (current) current.count += 1;
    else unreadByClient.set(row.clientId, { count: 1, latest: row });
  }
  for (const [clientId, { count, latest }] of unreadByClient) {
    replies.push({
      id: `${clientId}-msg-${latest.id}`,
      kind: 'message',
      clientId,
      clientName: fullName(latest.client),
      title: count > 1 ? `${count} nowe wiadomości` : 'Nowa wiadomość',
      body: String(latest.body || '').slice(0, 280),
      createdAt: latest.createdAt.toISOString(),
      activityId: latest.id,
      matchId: null,
      offerId: null,
      unreadCount: count,
    });
  }
  const replyRank = (kind: TodayReply['kind']) =>
    kind === 'viewing' ? 0 : kind === 'message' ? 1 : kind === 'handoff' ? 2 : kind === 'question' ? 3 : 4;
  replies.sort((a, b) => replyRank(a.kind) - replyRank(b.kind) || b.createdAt.localeCompare(a.createdAt));

  // ── 4. Dzisiejsze pokazy i spotkania ──────────────────────────────────────
  const upcoming = await fetchUpcomingScheduleEvents(params.scheduleUserId).catch(() => []);
  const schedule: TodayScheduleItem[] = upcoming
    .filter((event) => isSameWarsawDay(event.startsAt, now))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((event) => ({
      id: event.id,
      kind: event.kind,
      title: event.title,
      subtitle: event.subtitle,
      location: event.location,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      status: event.status,
      clientId: event.clientId ?? event.buyerClientId ?? null,
      offerId: event.offerId ?? null,
    }));

  // ── 5. Sprawy stojące w miejscu ───────────────────────────────────────────
  const staleRows = await prisma.$queryRaw<
    Array<{ id: number; firstName: string; lastName: string; type: string; phone: string | null; lastAt: Date }>
  >`
    SELECT c.id, c.firstName, c.lastName, c.type, c.phone,
           COALESCE(MAX(a.createdAt), c.createdAt) AS lastAt
    FROM AgencyClient c
    LEFT JOIN AgencyClientActivity a ON a.clientId = c.id
    WHERE c.agencyUserId = ${agencyUserId} AND c.status = 'ACTIVE'
    GROUP BY c.id, c.firstName, c.lastName, c.type, c.phone, c.createdAt
    HAVING lastAt < ${new Date(now.getTime() - STALE_AFTER_DAYS * DAY_MS)}
       AND lastAt > ${new Date(now.getTime() - STALE_MAX_DAYS * DAY_MS)}
    ORDER BY lastAt ASC
    LIMIT 8
  `;
  const busyClientIds = new Set([
    ...ownerCalls.map((row) => row.clientId),
    ...approvals.map((row) => row.clientId),
    ...replies.map((row) => row.clientId),
  ]);
  const stale: TodayStaleClient[] = staleRows
    .filter((row) => !busyClientIds.has(Number(row.id)))
    .map((row) => {
      const lastAt = new Date(row.lastAt);
      return {
        clientId: Number(row.id),
        clientName: fullName(row),
        type: row.type === 'SELLER' ? 'SELLER' : 'BUYER',
        phone: row.phone,
        lastActivityAt: lastAt.toISOString(),
        days: Math.max(STALE_AFTER_DAYS, Math.floor((now.getTime() - lastAt.getTime()) / DAY_MS)),
      };
    });

  const outbox = await listPendingOutbox(agencyUserId).catch(() => [] as OutboxItem[]);
  const counts = {
    outbox: outbox.length,
    ownerCalls: ownerCalls.length,
    approvals: approvals.length,
    replies: replies.length,
    schedule: schedule.length,
    stale: stale.length,
    total: outbox.length + ownerCalls.length + approvals.length + replies.length + schedule.length + stale.length,
  };
  return { generatedAt: now.toISOString(), counts, outbox, ownerCalls, approvals, replies, schedule, stale };
}
