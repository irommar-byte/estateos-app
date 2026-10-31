import type { Prisma } from '@prisma/client';
import { JOURNEY_ACTIVITY } from '@/lib/crm/clientJourney';
import {
  canAccessOffer,
  listClientDealsAll,
  parseData,
  withEvent,
  type DealArchiveMark,
  type DealStage,
  type DealStatus,
  type DealView,
} from '@/lib/crm/offerBuyerDeals';
import { endOfferPublication } from '@/lib/offerPublication';
import { prisma } from '@/lib/prisma';

const SCHEDULE_KINDS = [
  JOURNEY_ACTIVITY.MEETING,
  JOURNEY_ACTIVITY.MEETING_CHANGE,
  JOURNEY_ACTIVITY.MEETING_CONFIRMED,
  JOURNEY_ACTIVITY.PRESENTATION,
  JOURNEY_ACTIVITY.PRESENTATION_CHANGE,
  JOURNEY_ACTIVITY.PRESENTATION_CONFIRMED,
] as const;

export const STAGE_LABEL: Record<DealStage, string> = {
  interested: 'Zainteresowany',
  scheduling: 'Umawianie prezentacji',
  scheduled: 'Prezentacja umówiona',
  live: 'Prezentacja trwa',
  viewed: 'Po prezentacji',
  feedback: 'Opinia po prezentacji',
  negotiation: 'Negocjacje',
  reserved: 'Rezerwacja',
  preliminary: 'Umowa przedwstępna',
  deed: 'Akt notarialny',
  closed: 'Sfinalizowana',
  lost: 'Zakończona',
};

/** Etapy, których przerwanie wymaga świadomego potwierdzenia agenta. */
const CRITICAL_STAGES: DealStage[] = ['negotiation', 'reserved', 'preliminary', 'deed'];
const STAGE_ORDER: DealStage[] = ['lost', 'interested', 'scheduling', 'scheduled', 'live', 'viewed', 'feedback', 'negotiation', 'reserved', 'preliminary', 'deed', 'closed'];
const OPEN_OFFER = ['ACTIVE', 'PENDING'];

const OFFER_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Na rynku',
  PENDING: 'Czeka na publikację',
  IN_DEAL: 'W transakcji',
  SOLD: 'Sprzedana',
  ARCHIVED: 'Wycofana z rynku',
  REJECTED: 'Odrzucona przy weryfikacji',
};

export type ArchiveDealsChoice = 'pause' | 'close';
export type ArchiveOfferChoice = 'withdraw' | 'keep';
export type ArchiveDecisions = { deals?: ArchiveDealsChoice; offer?: ArchiveOfferChoice; confirmCritical?: boolean };

export type ArchiveImpactDeal = {
  id: number;
  offerId: number;
  offerTitle: string;
  side: 'buyer' | 'seller';
  counterpart: string;
  stage: DealStage;
  stageLabel: string;
  status: DealStatus;
  critical: boolean;
};

export type ArchiveImpact = {
  clientId: number;
  name: string;
  type: 'BUYER' | 'SELLER';
  stageLabel: string;
  offer: { id: number; title: string; status: string; statusLabel: string; open: boolean } | null;
  deals: ArchiveImpactDeal[];
  upcomingMeetings: number;
  hasPortal: boolean;
};

function startsAtFromMeta(metadata: unknown): Date | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = (metadata as Record<string, unknown>).startsAt;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function counterpartOf(view: DealView, clientId: number): { side: 'buyer' | 'seller'; name: string } {
  const isBuyer = view.buyer.kind === 'client' && view.buyer.clientId === clientId;
  if (isBuyer) return { side: 'buyer', name: view.seller?.name || 'Właściciel' };
  const buyer = view.buyer.kind === 'client' ? view.buyer.name : view.buyer.name || view.buyer.agency || 'Kupujący z innej agencji';
  return { side: 'seller', name: buyer };
}

function furthest(stages: DealStage[]): DealStage | null {
  return stages.reduce<DealStage | null>((best, s) => (best == null || STAGE_ORDER.indexOf(s) > STAGE_ORDER.indexOf(best) ? s : best), null);
}

/** Na jakim etapie jest klient — jednym zdaniem, do listy i do zapisu w archiwum. */
function clientStageLabel(type: 'BUYER' | 'SELLER', offerStatus: string | null, deals: ArchiveImpactDeal[]): string {
  const top = furthest(deals.filter((d) => d.status === 'ACTIVE' || d.status === 'PAUSED').map((d) => d.stage));
  if (type === 'SELLER') {
    if (offerStatus === 'SOLD') return 'Nieruchomość sprzedana';
    if (top && STAGE_ORDER.indexOf(top) >= STAGE_ORDER.indexOf('negotiation')) return `Oferta w transakcji · ${STAGE_LABEL[top]}`;
    if (offerStatus && OPEN_OFFER.includes(offerStatus)) return deals.length ? 'Oferta na rynku · są kupujący' : 'Oferta na rynku';
    return offerStatus ? OFFER_STATUS_LABEL[offerStatus] || 'Pozyskanie' : 'Pozyskanie';
  }
  if (deals.some((d) => d.status === 'WON')) return 'Kupił nieruchomość';
  return top ? STAGE_LABEL[top] : 'Szukał nieruchomości';
}

async function clientImpact(agencyUserId: number, client: {
  id: number;
  type: 'BUYER' | 'SELLER';
  firstName: string;
  lastName: string;
  portalToken: string | null;
  linkedOffer: { id: number; title: string; status: string } | null;
}): Promise<ArchiveImpact> {
  const views = await listClientDealsAll(agencyUserId, client.id);
  const deals: ArchiveImpactDeal[] = views.map((view) => {
    const other = counterpartOf(view, client.id);
    return {
      id: view.id,
      offerId: view.offerId,
      offerTitle: view.offer.title,
      side: other.side,
      counterpart: other.name,
      stage: view.stage,
      stageLabel: STAGE_LABEL[view.stage],
      status: view.status,
      critical: CRITICAL_STAGES.includes(view.stage) && (view.status === 'ACTIVE' || view.status === 'PAUSED'),
    };
  });
  const now = Date.now();
  const meetings = await prisma.agencyClientActivity.findMany({
    where: { clientId: client.id, kind: { in: [...SCHEDULE_KINDS] } },
    select: { metadata: true },
  });
  const offerStatus = client.linkedOffer ? String(client.linkedOffer.status).toUpperCase() : null;
  return {
    clientId: client.id,
    name: `${client.firstName} ${client.lastName}`.trim(),
    type: client.type,
    stageLabel: clientStageLabel(client.type, offerStatus, deals),
    offer: client.linkedOffer
      ? {
          id: client.linkedOffer.id,
          title: client.linkedOffer.title,
          status: offerStatus!,
          statusLabel: OFFER_STATUS_LABEL[offerStatus!] || offerStatus!,
          open: OPEN_OFFER.includes(offerStatus!),
        }
      : null,
    deals,
    upcomingMeetings: meetings.filter((m) => {
      const at = startsAtFromMeta(m.metadata);
      return at && at.getTime() >= now;
    }).length,
    hasPortal: Boolean(client.portalToken),
  };
}

const CLIENT_SELECT = {
  id: true,
  type: true,
  firstName: true,
  lastName: true,
  portalToken: true,
  linkedOffer: { select: { id: true, title: true, status: true } },
} as const;

/** Co jest powiązane z klientami przed archiwizacją: ścieżki w lejku, ogłoszenie, spotkania. */
export async function getArchiveImpact(agencyUserId: number, clientIds: number[]): Promise<ArchiveImpact[]> {
  const ids = [...new Set(clientIds.map(Number).filter((id) => Number.isFinite(id) && id > 0))].slice(0, 50);
  if (!ids.length) return [];
  const clients = await prisma.agencyClient.findMany({
    where: { agencyUserId, id: { in: ids }, status: 'ACTIVE' },
    select: CLIENT_SELECT,
  });
  return Promise.all(clients.map((c) => clientImpact(agencyUserId, c as Parameters<typeof clientImpact>[1])));
}

export class ArchiveDecisionError extends Error {}

/**
 * Archiwizacja klientów z decyzją agenta, co z tym, co po nich zostaje:
 * ścieżki w lejku — wstrzymać (wrócą po przywróceniu) albo zamknąć; ogłoszenie sprzedającego — wycofać albo zostawić.
 * Przerwanie negocjacji, rezerwacji lub umów wymaga potwierdzenia. Bez decyzji (np. stara aplikacja): wstrzymanie i ogłoszenie bez zmian.
 */
export async function archiveAgencyClients(params: {
  agencyUserId: number;
  clientIds: number[];
  decisions?: ArchiveDecisions;
}): Promise<{ archivedIds: number[]; clearedActivities: number; clearedPush: number; pausedDeals: number; closedDeals: number; withdrawnOffers: number }> {
  const empty = { archivedIds: [], clearedActivities: 0, clearedPush: 0, pausedDeals: 0, closedDeals: 0, withdrawnOffers: 0 };
  const impacts = await getArchiveImpact(params.agencyUserId, params.clientIds);
  if (!impacts.length) return empty;

  const decided = params.decisions;
  const openDeals = impacts.flatMap((i) => i.deals.filter((d) => d.status === 'ACTIVE' || d.status === 'PAUSED'));
  const openOffers = impacts.filter((i) => i.offer?.open);
  if (decided) {
    if (openDeals.length && !decided.deals) throw new ArchiveDecisionError('Zdecyduj, co zrobić z transakcjami w lejku.');
    if (openOffers.length && !decided.offer) throw new ArchiveDecisionError('Zdecyduj, co zrobić z ogłoszeniem sprzedającego.');
    if (openDeals.some((d) => d.critical) && !decided.confirmCritical) {
      throw new ArchiveDecisionError('Potwierdź, że przerywasz trwające negocjacje, rezerwację lub umowy.');
    }
  }
  const dealsChoice: ArchiveDealsChoice = decided?.deals || 'pause';
  const offerChoice: ArchiveOfferChoice = decided?.offer || 'keep';
  const ownedIds = impacts.map((i) => i.clientId);
  const now = new Date();

  const activities = await prisma.agencyClientActivity.findMany({
    where: { clientId: { in: ownedIds }, kind: { in: [...SCHEDULE_KINDS] } },
    select: { id: true, metadata: true },
  });
  const activityIdsToDelete = activities
    .filter((row) => {
      const startsAt = startsAtFromMeta(row.metadata);
      // Przyszłe i niepotwierdzone terminy znikają; przeszłe spotkania zostają w historii.
      return !startsAt || startsAt.getTime() >= now.getTime() - 2 * 60 * 60 * 1000;
    })
    .map((row) => row.id);

  // Jedna ścieżka może łączyć dwóch archiwizowanych klientów — obsługujemy ją raz.
  const dealOwner = new Map<number, ArchiveImpact>();
  for (const impact of impacts) {
    for (const d of impact.deals) if ((d.status === 'ACTIVE' || d.status === 'PAUSED') && !dealOwner.has(d.id)) dealOwner.set(d.id, impact);
  }

  const withdrawn: number[] = [];
  for (const impact of openOffers) {
    if (offerChoice !== 'withdraw' || !impact.offer) continue;
    if (await canAccessOffer(params.agencyUserId, impact.offer.id)) withdrawn.push(impact.offer.id);
  }

  const result = await prisma.$transaction(async (tx) => {
    if (activityIdsToDelete.length) {
      await tx.agencyClientActivity.deleteMany({ where: { id: { in: activityIdsToDelete } } });
    }
    const push = await tx.clientPortalPushSubscription.deleteMany({ where: { clientId: { in: ownedIds } } });

    for (const [dealId, impact] of dealOwner) {
      const row = await tx.offerBuyerDeal.findUnique({ where: { id: dealId }, select: { status: true, data: true } });
      if (!row || (row.status !== 'ACTIVE' && row.status !== 'PAUSED')) continue;
      const mark: DealArchiveMark = {
        clientId: impact.clientId,
        clientName: impact.name,
        action: dealsChoice,
        prevStatus: row.status as DealStatus,
        at: now.toISOString(),
      };
      const text =
        dealsChoice === 'close'
          ? `Zamknięte — ${impact.name} przeniesiony do archiwum`
          : `Wstrzymane — ${impact.name} przeniesiony do archiwum (wróci po przywróceniu klienta)`;
      await tx.offerBuyerDeal.update({
        where: { id: dealId },
        data: {
          status: dealsChoice === 'close' ? 'LOST' : 'PAUSED',
          data: withEvent(row.data, { actor: 'agent', text }, now, (d) => ({ ...d, archived: mark })),
        },
      });
    }

    await tx.agencyClient.updateMany({
      where: { id: { in: ownedIds }, agencyUserId: params.agencyUserId },
      data: { status: 'ARCHIVED' },
    });
    await tx.agencyClientActivity.createMany({
      data: impacts.map((impact) => {
        const deals = impact.deals.filter((d) => dealOwner.get(d.id)?.clientId === impact.clientId);
        const offerWithdrawn = Boolean(impact.offer && withdrawn.includes(impact.offer.id));
        const parts = [
          deals.length ? `${deals.length} ${deals.length === 1 ? 'transakcja' : 'transakcji'} ${dealsChoice === 'close' ? 'zamknięte' : 'wstrzymane'}` : null,
          impact.offer?.open ? (offerWithdrawn ? 'ogłoszenie wycofane z rynku' : 'ogłoszenie zostaje na rynku') : null,
          'zaplanowane spotkania wyczyszczone',
        ].filter(Boolean);
        return {
          clientId: impact.clientId,
          agencyUserId: params.agencyUserId,
          kind: 'CLIENT_ARCHIVED',
          title: 'Klient przeniesiony do archiwum',
          body: `${parts.join(', ')}.`.replace(/^./, (c) => c.toUpperCase()),
          metadata: {
            archivedAt: now.toISOString(),
            stageLabel: impact.stageLabel,
            dealsChoice,
            offerChoice: impact.offer?.open ? (offerWithdrawn ? 'withdraw' : 'keep') : null,
            offerId: impact.offer?.id ?? null,
            dealIds: deals.map((d) => d.id),
            clearedMeetings: impact.upcomingMeetings,
          } as Prisma.InputJsonValue,
        };
      }),
    });
    return { clearedPush: push.count };
  });

  // Ogłoszenia wycofujemy dopiero, gdy archiwizacja się zapisała.
  for (const offerId of withdrawn) {
    await endOfferPublication({ offerId, endReason: 'MANUAL_ARCHIVE', offerStatus: 'ARCHIVED' }).catch((error) =>
      console.warn('[client-archive] nie udało się wycofać ogłoszenia', offerId, error instanceof Error ? error.message : error),
    );
  }

  return {
    archivedIds: ownedIds,
    clearedActivities: activityIdsToDelete.length,
    clearedPush: result.clearedPush,
    pausedDeals: dealsChoice === 'pause' ? dealOwner.size : 0,
    closedDeals: dealsChoice === 'close' ? dealOwner.size : 0,
    withdrawnOffers: withdrawn.length,
  };
}

/** Przywrócenie klienta: karta wraca do aktywnych, a ścieżki wstrzymane przy archiwizacji — do poprzedniego statusu. */
export async function restoreAgencyClient(params: { clientId: number }): Promise<boolean> {
  const client = await prisma.agencyClient.findFirst({
    where: { id: params.clientId, status: 'ARCHIVED' },
    select: { id: true, agencyUserId: true },
  });
  if (!client) return false;
  const deals = await prisma.offerBuyerDeal.findMany({
    where: { agencyUserId: client.agencyUserId, status: 'PAUSED', OR: [{ buyerClientId: client.id }, { sellerClientId: client.id }] },
    select: { id: true, data: true },
  });
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.agencyClient.update({ where: { id: client.id }, data: { status: 'ACTIVE' } });
    for (const deal of deals) {
      const mark = parseData(deal.data).archived;
      if (!mark || mark.clientId !== client.id || mark.action !== 'pause') continue;
      await tx.offerBuyerDeal.update({
        where: { id: deal.id },
        data: {
          status: mark.prevStatus,
          data: withEvent(deal.data, { actor: 'agent', text: `Wznowione — ${mark.clientName} przywrócony z archiwum` }, now, (d) => ({ ...d, archived: null })),
        },
      });
    }
    await tx.agencyClientActivity.create({
      data: {
        clientId: client.id,
        agencyUserId: client.agencyUserId,
        kind: 'CLIENT_RESTORED',
        title: 'Klient przywrócony z archiwum',
        body: deals.length ? 'Wstrzymane transakcje wróciły do lejka.' : null,
      },
    });
  });
  return true;
}

export type ArchivedClientView = {
  clientId: number;
  name: string;
  type: 'BUYER' | 'SELLER';
  phone: string | null;
  email: string | null;
  linkedUserId: number | null;
  archivedAt: string | null;
  stageLabel: string;
  note: string | null;
  meetingsCleared: number;
  offer: { id: number; title: string; status: string; statusLabel: string; withdrawn: boolean } | null;
  deals: Array<{
    id: number;
    offerId: number;
    offerTitle: string;
    side: 'buyer' | 'seller';
    counterpart: string;
    stageLabel: string;
    status: DealStatus;
    /** paused — wstrzymana razem z klientem; closed — zamknięta przy archiwizacji; other — zakończona wcześniej albo nadal aktywna */
    state: 'paused' | 'closed' | 'active' | 'finished';
  }>;
};

/** Archiwum agenta: każdy klient z etapem, na którym był, i z tym, co po nim zostało, a co zostało wstrzymane. */
export async function listArchivedClients(agencyUserId: number): Promise<ArchivedClientView[]> {
  const clients = await prisma.agencyClient.findMany({
    where: { agencyUserId, status: 'ARCHIVED' },
    orderBy: { updatedAt: 'desc' },
    take: 200,
    select: {
      ...CLIENT_SELECT,
      phone: true,
      email: true,
      linkedUserId: true,
      activities: {
        where: { kind: 'CLIENT_ARCHIVED' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true, body: true, metadata: true },
      },
    },
  });
  return Promise.all(
    clients.map(async (c) => {
      const views = await listClientDealsAll(agencyUserId, c.id);
      const archivedRow = c.activities[0] || null;
      const meta = (archivedRow?.metadata && typeof archivedRow.metadata === 'object' ? archivedRow.metadata : {}) as Record<string, unknown>;
      const offerStatus = c.linkedOffer ? String(c.linkedOffer.status).toUpperCase() : null;
      const deals = views.map((view) => {
        const other = counterpartOf(view, c.id);
        const mark = view.archived;
        const state: ArchivedClientView['deals'][number]['state'] =
          mark && mark.clientId === c.id
            ? mark.action === 'pause' && view.status === 'PAUSED'
              ? 'paused'
              : 'closed'
            : view.status === 'ACTIVE' || view.status === 'PAUSED'
              ? 'active'
              : 'finished';
        return {
          id: view.id,
          offerId: view.offerId,
          offerTitle: view.offer.title,
          side: other.side,
          counterpart: other.name,
          stageLabel: STAGE_LABEL[view.stage],
          status: view.status,
          state,
        };
      });
      const fallbackStage = clientStageLabel(
        c.type as 'BUYER' | 'SELLER',
        offerStatus,
        views.map((v) => ({ stage: v.stage, status: v.status }) as ArchiveImpactDeal),
      );
      return {
        clientId: c.id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        type: c.type as 'BUYER' | 'SELLER',
        phone: c.phone,
        email: c.email,
        linkedUserId: c.linkedUserId,
        archivedAt: archivedRow ? archivedRow.createdAt.toISOString() : null,
        stageLabel: typeof meta.stageLabel === 'string' ? meta.stageLabel : fallbackStage,
        note: archivedRow?.body || null,
        meetingsCleared: Number(meta.clearedMeetings) || 0,
        offer: c.linkedOffer
          ? {
              id: c.linkedOffer.id,
              title: c.linkedOffer.title,
              status: offerStatus!,
              statusLabel: OFFER_STATUS_LABEL[offerStatus!] || offerStatus!,
              withdrawn: meta.offerChoice === 'withdraw',
            }
          : null,
        deals,
      };
    }),
  );
}
