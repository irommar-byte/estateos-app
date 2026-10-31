import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { JOURNEY_ACTIVITY, resolvePresentation, type ActivityLike, type ScheduleSlot } from '@/lib/crm/clientJourney';
import { parseClientOfferFeedback } from '@/lib/crm/clientPortalFeedback';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { tidySentence } from '@/lib/crm/clientMessageEmail';
import { getSmartAgentAccess, getSmartAgentTriggers } from '@/lib/crm/smartAgent';

/**
 * Kupujący na nieruchomości — jedno miejsce, które łączy sprzedającego, kupującego i ofertę.
 * Wiersz OfferBuyerDeal powstaje sam (wysłana oferta z radaru, zapytanie, umówiona prezentacja,
 * prośba innej agencji) albo ręcznie. Terminy prezentacji zostają w aktywnościach klienta
 * (jak dotąd) — tutaj je tylko odczytujemy i dokładamy to, czego brakowało: potwierdzenie ze skanu,
 * opinię, kontrolę agenta nad tym, co trafia do sprzedającego, i historię „kto co zaproponował”.
 */

const SCHEDULE_KINDS: string[] = [
  JOURNEY_ACTIVITY.PRESENTATION,
  JOURNEY_ACTIVITY.PRESENTATION_CHANGE,
  JOURNEY_ACTIVITY.PRESENTATION_CONFIRMED,
  JOURNEY_ACTIVITY.PRESENTATION_HELD,
];
const TRACKED_KINDS: string[] = [
  ...SCHEDULE_KINDS,
  JOURNEY_ACTIVITY.LISTING_SHOWING_REQUESTED,
  'PRESENTATION_DEBRIEF',
  'PRESENTATION_ATTENDANCE_DOC',
  'EXTERNAL_PORTAL_LEAD',
];

export type DealStatus = 'ACTIVE' | 'PAUSED' | 'LOST' | 'WON';
export type DealStage =
  | 'interested'
  | 'scheduling'
  | 'scheduled'
  | 'live'
  | 'viewed'
  | 'feedback'
  | 'negotiation'
  | 'reserved'
  | 'preliminary'
  | 'deed'
  | 'closed'
  | 'lost';
export type DealSentiment = 'like' | 'maybe' | 'dislike';
export type DealActor = 'agent' | 'buyer' | 'seller' | 'other_agent';

type DealEvent = { at: string; actor: DealActor; text: string };

export type OfferSide = 'buyer' | 'seller';
export type NegotiationOffer = {
  id: string;
  at: string;
  by: OfferSide;
  amount: number;
  note: string | null;
  status: 'open' | 'accepted' | 'rejected' | 'countered' | 'withdrawn';
  /** Propozycja przekazana sprzedającemu do panelu (SellerBuyerOffer). */
  sellerBuyerOfferId?: number | null;
  sentToSellerAt?: string | null;
  sentToBuyerAt?: string | null;
  /** Odpowiedź drugiej strony (panel albo wpis agenta) — czeka na zatwierdzenie agenta. */
  response?: OfferResponse | null;
  /** Agent zatwierdził odpowiedź i przekazał ją dalej. */
  handledAt?: string | null;
};
export type OfferResponse = {
  kind: 'accept' | 'counter' | 'reject';
  amount?: number | null;
  comment?: string | null;
  at: string;
  via: 'panel' | 'agent';
};
/** Czas drugiej strony na odpowiedź na ofertę. */
export const OFFER_RESPONSE_HOURS = 48;
export type DealTurn = {
  side: 'agent' | 'buyer' | 'seller' | null;
  label: string;
  /** Do kiedy strona ma odpowiedzieć (zegar 48 h). */
  deadline: string | null;
  offerId: string | null;
};
export type PhaseId = 'presentation' | 'feedback' | 'negotiation' | 'reservation' | 'transaction';
export type Negotiation = {
  startedAt?: string | null;
  skippedPresentation?: boolean;
  offers?: NegotiationOffer[];
  financing?: { kind: 'cash' | 'mortgage' | 'mixed'; bank?: string | null; decision?: 'none' | 'pending' | 'approved' | 'rejected' } | null;
  terms?: { deposit?: number | null; preliminaryAt?: string | null; deedAt?: string | null; handoverAt?: string | null; note?: string | null } | null;
  reservation?: { until: string; at: string } | null;
  /** Agent przeszedł do umowy bez rezerwacji. */
  reservationSkipped?: boolean;
  agreedPrice?: number | null;
  othersDecision?: 'paused' | 'backup' | null;
};
export type TransactionStepId = 'preliminary' | 'deed' | 'handover' | 'commission';
export type TransactionStep = {
  date?: string | null;
  done?: boolean;
  doneAt?: string | null;
  place?: string | null;
  amount?: number | null;
  note?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
};
export type Transaction = Partial<Record<TransactionStepId, TransactionStep>> & { documentsStartedAt?: string | null };

export type DealData = {
  events?: DealEvent[];
  /** Kopia transakcji z Dealroomu (prywatny kupujący ↔ oferta agenta). Odświeżana przy odczycie. */
  dealroom?: { dealId: number; status: string; events: DealEvent[]; syncedAt: string };
  reminders?: Record<string, string>;
  searchOther?: { wanted: boolean; note: string | null; at: string } | null;
  /** Agent potwierdził telefonicznie, że kupujący chce obejrzeć (i kiedy mu pasuje). */
  intent?: { confirmedAt: string; note: string | null } | null;
  negotiation?: Negotiation;
  transaction?: Transaction;
};

export type GuideStep = {
  title: string;
  detail: string;
  /** Z kim kontakt w tym kroku — okno pokazuje od razu wizytówkę tej osoby. */
  contact: 'buyer' | 'seller' | null;
  /** Przycisk(i), które okno pokazuje przy kroku. */
  action: 'confirm_intent' | 'schedule' | 'accept_client_slot' | 'remind_buyer' | null;
};

export type DealGuide = {
  intent: 'unclear' | 'wants';
  headline: string;
  story: string;
  lastMessage: { text: string; at: string } | null;
  steps: GuideStep[];
};

export type DealView = {
  id: number;
  offerId: number;
  status: DealStatus;
  source: string;
  sourceLabel: string;
  offer: { id: number; title: string; address: string; price: number | null; imageUrl: string | null };
  seller: { clientId: number; name: string; phone: string | null; email: string | null } | null;
  buyer:
    | { kind: 'client'; clientId: number; name: string; phone: string | null; email: string | null }
    | { kind: 'external'; agency: string | null; name: string | null; phone: string | null; email: string | null };
  stage: DealStage;
  /** Dlaczego kupujący pojawił się w lejku — konkretna akcja i kiedy. */
  entry: { reason: string; at: string | null; qualified: boolean; signal?: 'like' | 'maybe' | 'favorite' | null };
  /** Wyjaśnienie sytuacji i kroki dla agenta — co zrobić teraz, z kim i w jakiej kolejności. */
  guide: DealGuide | null;
  phases: Array<{
    id: PhaseId;
    label: string;
    done: boolean;
    current: boolean;
    skipped: boolean;
    /** Jedna linia z wynikiem zakończonego etapu, np. „12 lis ✓ · podoba się”. */
    summary: string | null;
  }>;
  /** Kto ma teraz ruch w negocjacjach i do kiedy. */
  turn: DealTurn;
  presentation: {
    startsAt: string;
    status: 'pending' | 'confirmed';
    proposedBy: 'agent' | 'client';
    proposedSlots: string[];
    heldAt: string | null;
    past: boolean;
  } | null;
  attendance: { signed: boolean; via: 'tablet' | 'scan' | null; documentId: string | null; url: string | null; name: string | null; at: string | null };
  feedback: { sentiment: DealSentiment; note: string | null; by: 'buyer' | 'agent'; at: string | null } | null;
  feedbackRequestedAt: string | null;
  sellerInformedAt: string | null;
  searchOther: DealData['searchOther'];
  negotiation: Required<Pick<Negotiation, 'offers'>> & Omit<Negotiation, 'offers'>;
  transaction: Transaction;
  /** Agent zaczął etap dokumentów (cena uzgodniona, rezerwacja albo ręcznie). */
  documentsVisible: boolean;
  nextAction: string;
  timeline: DealEvent[];
  updatedAt: string;
};

/** Prezentacja „w toku” przez godzinę od rozpoczęcia. */
const PRESENTATION_LIVE_MS = 60 * 60 * 1000;

function attendanceSigned(deal: { attendanceUrl: string | null }, rows: ActivityLike[]): boolean {
  if (deal.attendanceUrl) return true;
  return rows.some((row) => row.kind === JOURNEY_ACTIVITY.PRESENTATION_HELD && Boolean(asMeta(asMeta(row.metadata).attendanceSlip).documentId));
}

const SOURCE_LABELS: Record<string, string> = {
  radar: 'Reakcja na ofertę z radaru',
  presentation: 'Umówiona prezentacja',
  inquiry: 'Zapytanie z portalu',
  listing_request: 'Prośba innej agencji',
  guest_agency: 'Pokazuje inna agencja',
  manual: 'Dodany ręcznie',
  dealroom: 'Dealroom (kupujący z portalu)',
};

function asMeta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function positiveId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function parseData(raw: unknown): DealData {
  const meta = asMeta(raw);
  return {
    ...(meta as DealData),
    events: Array.isArray(meta.events) ? (meta.events as DealEvent[]) : [],
    reminders: asMeta(meta.reminders) as Record<string, string>,
    searchOther: (meta.searchOther as DealData['searchOther']) ?? null,
    negotiation: asMeta(meta.negotiation) as Negotiation,
    transaction: asMeta(meta.transaction) as Transaction,
  };
}

/** Zmienia dane ścieżki i dopisuje wpis do historii. */
export function withEvent(
  raw: unknown,
  event: Omit<DealEvent, 'at'>,
  at = new Date(),
  patch?: (data: DealData) => DealData,
): Prisma.InputJsonValue {
  const base = parseData(raw);
  const data = patch ? patch(base) : base;
  const events = [...(data.events || []), { ...event, at: at.toISOString() }].slice(-200);
  return { ...data, events } as unknown as Prisma.InputJsonValue;
}

const DAY = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', day: 'numeric', month: 'long' });

export function day(value: string | Date): string {
  return DAY.format(typeof value === 'string' ? new Date(value) : value);
}

export function pln(value: number): string {
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

const WHEN = new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function when(value: string | Date): string {
  return WHEN.format(typeof value === 'string' ? new Date(value) : value);
}

function sentimentFromOutcome(outcome: unknown): DealSentiment | null {
  if (outcome === 'interested') return 'like';
  if (outcome === 'maybe') return 'maybe';
  if (outcome === 'reject') return 'dislike';
  return null;
}

export const SENTIMENT_LABEL: Record<DealSentiment, string> = {
  like: 'Podoba się',
  maybe: 'Zastanawia się',
  dislike: 'Nie pasuje',
};

/* ───────────────────────── dostęp ───────────────────────── */

export async function canAccessOffer(agencyUserId: number, offerId: number): Promise<boolean> {
  const offer = await prisma.offer.findFirst({ where: { id: offerId }, select: { userId: true } });
  if (!offer) return false;
  if (offer.userId === agencyUserId) return true;
  const linked = await prisma.agencyClient.count({
    where: { agencyUserId, status: 'ACTIVE', OR: [{ linkedOfferId: offerId }, { matches: { some: { offerId } } }] },
  });
  return linked > 0;
}

async function sellerClientFor(agencyUserId: number, offerId: number) {
  return prisma.agencyClient.findFirst({
    where: { agencyUserId, type: 'SELLER', status: 'ACTIVE', linkedOfferId: offerId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, firstName: true, lastName: true },
  });
}

/* ───────────────────── automatyczne dopisywanie kupujących ───────────────────── */

type NewDeal = Prisma.OfferBuyerDealCreateManyInput;

/** Dopisuje kupujących, którzy pojawili się przy ofercie, a nie mają jeszcze wiersza. */
export async function syncOfferBuyerDeals(agencyUserId: number, offerId: number): Promise<void> {
  const seller = await sellerClientFor(agencyUserId, offerId);
  const rows: NewDeal[] = [];
  const base = { agencyUserId, offerId, sellerClientId: seller?.id ?? null };

  // Z radaru do lejka trafia tylko kupujący, który zareagował (nie odmową): „Chcę obejrzeć”, „Do przemyślenia”, ulubione.
  const matches = await prisma.agencyClientMatch.findMany({
    where: {
      offerId,
      OR: [{ clientFeedback: { not: null } }, { clientFavorite: true }],
      client: { agencyUserId, type: 'BUYER', status: 'ACTIVE' },
    },
    select: { clientId: true, clientFeedback: true, clientFavorite: true },
  });
  for (const match of matches) {
    const sentiment = parseClientOfferFeedback(match.clientFeedback).sentiment;
    if (sentiment === 'like' || sentiment === 'maybe' || match.clientFavorite) {
      rows.push({ ...base, buyerClientId: match.clientId, source: 'radar' });
    }
  }

  const activities = await prisma.agencyClientActivity.findMany({
    where: { offerId, kind: { in: TRACKED_KINDS } },
    select: { id: true, clientId: true, agencyUserId: true, kind: true, metadata: true, client: { select: { type: true } } },
    orderBy: { createdAt: 'asc' },
  });
  for (const row of activities) {
    const meta = asMeta(row.metadata);
    if (row.agencyUserId !== agencyUserId) {
      // Kupujący innego agenta — widzimy tylko agencję, bez danych osobowych kupującego.
      if (row.kind === JOURNEY_ACTIVITY.LISTING_SHOWING_REQUESTED || meta.listingRequestSent === true) {
        rows.push({ ...base, externalKey: `agent:${row.clientId}`, source: 'listing_request' });
      }
      continue;
    }
    if (row.client.type === 'BUYER') {
      const source = row.kind === 'EXTERNAL_PORTAL_LEAD' ? 'inquiry' : 'presentation';
      rows.push({ ...base, buyerClientId: row.clientId, source });
      continue;
    }
    if (!SCHEDULE_KINDS.includes(row.kind)) continue;
    const buyerId = positiveId(meta.buyerClientId);
    const guest = asMeta(meta.guestAgency);
    if (buyerId) rows.push({ ...base, buyerClientId: buyerId, source: 'presentation' });
    else if (guest.name) {
      rows.push({
        ...base,
        externalKey: `guest:${String(guest.email || guest.name).toLowerCase().slice(0, 56)}`,
        externalAgency: String(guest.name).slice(0, 160),
        externalName: guest.visitorName ? String(guest.visitorName).slice(0, 160) : null,
        externalPhone: guest.phone ? String(guest.phone).slice(0, 32) : null,
        externalEmail: guest.email ? String(guest.email).slice(0, 191) : null,
        source: 'guest_agency',
      });
    } else {
      rows.push({ ...base, externalKey: `seller:${row.clientId}`, source: 'presentation' });
    }
  }

  if (rows.length) await prisma.offerBuyerDeal.createMany({ data: rows, skipDuplicates: true });
  await syncDealroomDeals(agencyUserId, offerId, seller?.id ?? null).catch((error) => {
    console.error('[offerBuyerDeals.dealroom]', error);
  });
  if (seller) {
    await prisma.offerBuyerDeal.updateMany({
      where: { offerId, agencyUserId, sellerClientId: null },
      data: { sellerClientId: seller.id },
    });
  }
}

const DEALROOM_STATUS_LABEL: Record<string, string> = {
  INITIATED: 'Rozpoczęta rozmowa',
  NEGOTIATION: 'Negocjacje',
  AGREED: 'Cena uzgodniona',
  MEETING: 'Umówione spotkanie',
  FINALIZED: 'Transakcja zakończona',
  CANCELLED: 'Anulowana',
};

const APPT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'czeka na odpowiedź',
  ACCEPTED: 'potwierdzony',
  DECLINED: 'odrzucony',
  RESCHEDULED: 'przełożony',
  CANCELLED: 'odwołany',
  COMPLETED: 'odbyty',
  NO_SHOW: 'nieobecność',
};

/**
 * Jedna oś transakcji: rozmowy z Dealroomu przy ofercie agenta trafiają do listy kupujących w CRM
 * (z ofertami cenowymi i terminami jako wydarzeniami). Dealroom zostaje miejscem rozmowy kupującego,
 * CRM — miejscem prowadzenia transakcji przez agenta.
 */
async function syncDealroomDeals(agencyUserId: number, offerId: number, sellerClientId: number | null): Promise<void> {
  const offer = await prisma.offer.findUnique({ where: { id: offerId }, select: { userId: true } });
  if (!offer) return;
  if (offer.userId !== agencyUserId && !sellerClientId) return;

  const deals = await prisma.deal.findMany({
    where: { offerId },
    select: {
      id: true,
      status: true,
      buyerId: true,
      sellerId: true,
      createdAt: true,
      buyer: { select: { id: true, name: true, email: true, phone: true } },
      bids: { orderBy: { createdAt: 'asc' }, select: { amount: true, senderId: true, status: true, createdAt: true } },
      appointments: { orderBy: { createdAt: 'asc' }, select: { proposedDate: true, proposedById: true, status: true, createdAt: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 10, select: { senderId: true, content: true, createdAt: true } },
    },
  });
  if (!deals.length) return;

  const linkedBuyers = await prisma.agencyClient.findMany({
    where: { agencyUserId, type: 'BUYER', linkedUserId: { in: deals.map((d) => d.buyerId) } },
    select: { id: true, linkedUserId: true },
  });
  const buyerClientByUser = new Map(linkedBuyers.map((c) => [c.linkedUserId, c.id]));

  for (const deal of deals) {
    const buyerClientId = buyerClientByUser.get(deal.buyerId) ?? null;
    const where = buyerClientId
      ? { offerId_buyerClientId: { offerId, buyerClientId } }
      : { offerId_externalKey: { offerId, externalKey: `dealroom:${deal.id}` } };

    const events: DealEvent[] = [
      { at: deal.createdAt.toISOString(), actor: 'buyer', text: 'Kupujący otworzył rozmowę w Dealroomie' },
    ];
    for (const bid of deal.bids) {
      const byBuyer = bid.senderId === deal.buyerId;
      const state = bid.status === 'ACCEPTED' ? ' · przyjęta' : bid.status === 'REJECTED' ? ' · odrzucona' : bid.status === 'COUNTER_OFFER' ? ' · kontrowana' : '';
      events.push({
        at: bid.createdAt.toISOString(),
        actor: byBuyer ? 'buyer' : 'seller',
        text: `${byBuyer ? 'Oferta kupującego' : 'Kontroferta'}: ${pln(bid.amount)}${state}`,
      });
    }
    for (const appt of deal.appointments) {
      const state = APPT_STATUS_LABEL[String(appt.status)] || String(appt.status).toLowerCase();
      events.push({
        at: appt.createdAt.toISOString(),
        actor: appt.proposedById === deal.buyerId ? 'buyer' : 'seller',
        text: `Termin w Dealroomie: ${when(appt.proposedDate)} · ${state}`,
      });
    }

    for (const message of [...deal.messages].reverse()) {
      const byBuyer = message.senderId === deal.buyerId;
      events.push({
        at: message.createdAt.toISOString(),
        actor: byBuyer ? 'buyer' : 'seller',
        text: `${byBuyer ? 'Kupujący napisał' : 'Odpowiedź'}: „${String(message.content || '').replace(/\s+/g, ' ').trim().slice(0, 240)}”`,
      });
    }
    events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    const status: DealStatus | null =
      deal.status === 'CANCELLED' ? 'LOST' : deal.status === 'FINALIZED' ? 'WON' : null;

    const existing = await prisma.offerBuyerDeal.findUnique({ where, select: { id: true, data: true, status: true } });
    const data = parseData(existing?.data);
    data.dealroom = {
      dealId: deal.id,
      status: DEALROOM_STATUS_LABEL[deal.status] || deal.status,
      events,
      syncedAt: new Date().toISOString(),
    };
    if (existing) {
      await prisma.offerBuyerDeal.update({
        where: { id: existing.id },
        data: {
          data: data as Prisma.InputJsonValue,
          ...(status && existing.status === 'ACTIVE' ? { status } : {}),
        },
      });
    } else {
      await prisma.offerBuyerDeal.create({
        data: {
          agencyUserId,
          offerId,
          sellerClientId,
          buyerClientId,
          externalKey: buyerClientId ? null : `dealroom:${deal.id}`,
          externalName: buyerClientId ? null : (deal.buyer.name || 'Kupujący z Dealroomu').slice(0, 160),
          externalEmail: buyerClientId ? null : deal.buyer.email ? deal.buyer.email.slice(0, 191) : null,
          externalPhone: buyerClientId ? null : deal.buyer.phone ? deal.buyer.phone.slice(0, 32) : null,
          source: 'dealroom',
          status: status || 'ACTIVE',
          data: data as Prisma.InputJsonValue,
        },
      }).catch(() => null);
    }
  }
}

/** Oferty, przy których kupujący ma już coś więcej niż samo wysłanie z radaru. */
async function syncBuyerClientDeals(agencyUserId: number, buyerClientId: number): Promise<void> {
  const rows = await prisma.agencyClientActivity.findMany({
    where: { clientId: buyerClientId, offerId: { not: null }, kind: { in: TRACKED_KINDS } },
    select: { offerId: true },
    distinct: ['offerId'],
  });
  for (const row of rows) {
    if (row.offerId) await syncOfferBuyerDeals(agencyUserId, row.offerId);
  }
}

/* ───────────────────────── stan jednego kupującego ───────────────────────── */

type DealRow = Awaited<ReturnType<typeof prisma.offerBuyerDeal.findMany>>[number];
type ActivityRow = ActivityLike & { clientId: number; agencyUserId: number };

function activitiesForDeal(deal: DealRow, all: ActivityRow[]): ActivityRow[] {
  if (deal.buyerClientId) return all.filter((row) => row.clientId === deal.buyerClientId);
  const key = deal.externalKey || '';
  if (key.startsWith('agent:')) {
    const clientId = Number(key.slice(6));
    return all.filter((row) => row.clientId === clientId);
  }
  if (key.startsWith('guest:')) {
    const guestKey = key.slice(6);
    return all.filter((row) => {
      const guest = asMeta(asMeta(row.metadata).guestAgency);
      return guest.name && String(guest.email || guest.name).toLowerCase().slice(0, 56) === guestKey;
    });
  }
  if (key.startsWith('seller:')) {
    const clientId = Number(key.slice(7));
    return all.filter((row) => {
      const meta = asMeta(row.metadata);
      return row.clientId === clientId && !positiveId(meta.buyerClientId) && !asMeta(meta.guestAgency).name;
    });
  }
  return [];
}

function latest(rows: ActivityRow[], kind: string): ActivityRow | null {
  const found = rows.filter((row) => row.kind === kind);
  return found.length ? found[found.length - 1] : null;
}

function buildTimeline(
  rows: ActivityRow[],
  deal: DealRow,
  matchFeedback: { text: string; at: string } | null,
  extra: DealEvent[],
): DealEvent[] {
  const events: DealEvent[] = [];
  const foreign = (row: ActivityRow) => row.agencyUserId !== deal.agencyUserId;
  for (const row of rows) {
    const meta = asMeta(row.metadata);
    const at = iso(row.createdAt) || new Date().toISOString();
    const startsAt = typeof meta.startsAt === 'string' ? meta.startsAt : null;
    const slots = Array.isArray(meta.proposedSlots) ? (meta.proposedSlots as string[]) : startsAt ? [startsAt] : [];
    const slotText = slots.slice(0, 3).map(when).join(' · ');
    if (row.kind === JOURNEY_ACTIVITY.PRESENTATION) {
      const actor: DealActor = foreign(row) ? 'other_agent' : meta.proposedBy === 'client' ? 'buyer' : 'agent';
      events.push({ at, actor, text: `${slots.length > 1 ? 'Zaproponowano terminy' : 'Zaproponowano termin'}: ${slotText}` });
    } else if (row.kind === JOURNEY_ACTIVITY.PRESENTATION_CHANGE) {
      events.push({
        at,
        actor: meta.proposedBy === 'client' ? 'buyer' : 'agent',
        text: `Propozycja zmiany terminu: ${startsAt ? when(startsAt) : ''}${meta.reason ? ` (${String(meta.reason)})` : ''}`,
      });
    } else if (row.kind === JOURNEY_ACTIVITY.PRESENTATION_CONFIRMED) {
      events.push({ at, actor: foreign(row) ? 'other_agent' : 'agent', text: `Termin potwierdzony: ${startsAt ? when(startsAt) : ''}` });
    } else if (row.kind === JOURNEY_ACTIVITY.PRESENTATION_HELD) {
      events.push({ at, actor: 'agent', text: asMeta(meta.attendanceSlip).documentId ? 'Prezentacja odbyta, potwierdzenie podpisane na tablecie' : 'Prezentacja odbyta' });
    } else if (row.kind === 'PRESENTATION_DEBRIEF') {
      const sentiment = sentimentFromOutcome(meta.outcome);
      if (sentiment) {
        events.push({
          at,
          actor: 'agent',
          text: `Po pokazie: ${SENTIMENT_LABEL[sentiment]}${meta.priceHint ? ` · ${String(meta.priceHint)}` : ''}`,
        });
      }
    } else if (row.kind === 'EXTERNAL_PORTAL_LEAD') {
      events.push({ at, actor: 'buyer', text: 'Zapytanie z portalu' });
    } else if (row.kind === JOURNEY_ACTIVITY.LISTING_SHOWING_REQUESTED) {
      events.push({ at, actor: 'other_agent', text: `Prośba o pokaz: ${slotText}` });
    }
  }
  if (matchFeedback) events.push({ at: matchFeedback.at, actor: 'buyer', text: matchFeedback.text });
  events.push(...(parseData(deal.data).events || []), ...extra);
  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

type Context = {
  activities: ActivityRow[];
  matches: Array<{ clientId: number; offerId: number; clientFeedback: string | null; clientFeedbackAt: Date | null; clientFavorite: boolean; favoriteAt: Date | null }>;
  clients: Map<number, { firstName: string; lastName: string; phone: string | null; email: string | null }>;
  offers: Map<number, { id: number; title: string; street: string | null; district: string; city: string; price: number; images: string | null }>;
  agencies: Map<number, string>;
  sellerOffers: Map<number, { status: string; clientResponse: string | null; counterAmount: number | null; clientComment: string | null; updatedAt: Date }>;
};

/** Odpowiedzi sprzedającego z panelu (przyjmuje / kontroferta / odrzuca) dopinamy do propozycji — rozstrzyga agent. */
function mergeSellerResponses(offers: NegotiationOffer[], ctx: Context): { offers: NegotiationOffer[]; events: DealEvent[] } {
  const events: DealEvent[] = [];
  const merged = offers.map((offer) => {
    const row = offer.sellerBuyerOfferId ? ctx.sellerOffers.get(offer.sellerBuyerOfferId) : null;
    if (!row?.clientResponse || !['accept', 'counter', 'reject'].includes(row.clientResponse)) return offer;
    const at = row.updatedAt.toISOString();
    const comment = row.clientComment ? ` — „${row.clientComment}”` : '';
    const kind = row.clientResponse as OfferResponse['kind'];
    events.push({
      at,
      actor: 'seller',
      text: kind === 'accept' ? `Przyjmuje ${pln(offer.amount)}${comment}` : kind === 'reject' ? `Odrzuca ${pln(offer.amount)}${comment}` : `Kontroferta: ${pln(Number(row.counterAmount))}${comment}`,
    });
    if (offer.response) return offer;
    return { ...offer, response: { kind, amount: row.counterAmount, comment: row.clientComment, at, via: 'panel' as const } };
  });
  return { offers: merged.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()), events };
}

/** Komu przypada ruch: propozycja czeka na wysłanie, na odpowiedź strony albo na decyzję agenta. */
export function negotiationTurn(offers: NegotiationOffer[], agreed: boolean, hasSeller: boolean, hasBuyerPortal: boolean): DealTurn {
  if (agreed) return { side: null, label: 'Cena uzgodniona', deadline: null, offerId: null };
  const open = [...offers].reverse().find((offer) => offer.status === 'open') || null;
  if (!open) return { side: 'agent', label: 'Zapisz propozycję ceny', deadline: null, offerId: null };
  const other = open.by === 'buyer' ? 'seller' : 'buyer';
  const otherName = other === 'seller' ? 'sprzedającego' : 'kupującego';
  if (open.response) {
    const verb = open.response.kind === 'accept' ? 'przyjmuje' : open.response.kind === 'reject' ? 'odrzuca' : `proponuje ${pln(Number(open.response.amount))}`;
    return { side: 'agent', label: `${other === 'seller' ? 'Sprzedający' : 'Kupujący'} ${verb} — zatwierdź`, deadline: null, offerId: open.id };
  }
  const sentAt = open.by === 'buyer' ? open.sentToSellerAt : open.sentToBuyerAt;
  if (!sentAt) {
    const reachable = other === 'seller' ? hasSeller : hasBuyerPortal;
    return {
      side: 'agent',
      label: reachable ? `Zatwierdź i wyślij do ${otherName}` : `Przekaż ${other === 'seller' ? 'sprzedającemu' : 'kupującemu'} telefonicznie i zapisz odpowiedź`,
      deadline: null,
      offerId: open.id,
    };
  }
  const deadline = new Date(new Date(sentAt).getTime() + OFFER_RESPONSE_HOURS * 3600 * 1000).toISOString();
  return { side: other, label: `Czekamy na ${otherName} (${pln(open.amount)})`, deadline, offerId: open.id };
}

function clip(text: unknown, max = 110): string {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Konkretny powód, dla którego kupujący jest w lejku. qualified=false → sama wysyłka bez reakcji albo odmowa. */
function dealEntry(
  deal: DealRow,
  rows: ActivityRow[],
  slot: ScheduleSlot | null,
  match: Context['matches'][number] | undefined,
  parsed: ReturnType<typeof parseClientOfferFeedback>,
): DealView['entry'] {
  const note = parsed.note ? ` — „${clip(parsed.note, 80)}”` : '';
  const feedbackAt = iso(match?.clientFeedbackAt) || null;
  const firstSchedule = rows.find((row) => SCHEDULE_KINDS.includes(row.kind)) || null;
  const scheduleEntry = (): DealView['entry'] | null =>
    firstSchedule
      ? {
          reason:
            slot?.proposedBy === 'client'
              ? 'Kupujący sam zaproponował termin prezentacji'
              : 'Prezentacja umówiona przez agenta',
          at: iso(firstSchedule.createdAt) || null,
          qualified: true,
        }
      : null;

  switch (deal.source) {
    case 'radar': {
      if (parsed.sentiment === 'like') {
        return { reason: `Klik „Chcę obejrzeć” przy ofercie od agenta poszukiwań${note}`, at: feedbackAt, qualified: true, signal: 'like' };
      }
      if (parsed.sentiment === 'maybe') {
        return { reason: `Odpowiedź „Do przemyślenia” na ofertę od agenta poszukiwań${note}`, at: feedbackAt, qualified: true, signal: 'maybe' };
      }
      if (match?.clientFavorite) {
        return { reason: 'Oferta dodana do ulubionych w panelu klienta', at: iso(match.favoriteAt) || null, qualified: true, signal: 'favorite' };
      }
      const viaSchedule = scheduleEntry();
      if (viaSchedule) return viaSchedule;
      if (parsed.sentiment === 'dislike') return { reason: `Odpowiedź „Nie pasuje”${note}`, at: feedbackAt, qualified: false };
      return { reason: 'Oferta wysłana z radaru — bez reakcji', at: null, qualified: false };
    }
    case 'inquiry': {
      const lead = rows.find((row) => row.kind === 'EXTERNAL_PORTAL_LEAD');
      const text = clip(lead?.body || lead?.title);
      return { reason: text ? `Zapytanie z portalu: „${text}”` : 'Zapytanie z portalu', at: iso(lead?.createdAt) || iso(deal.createdAt) || null, qualified: true };
    }
    case 'listing_request': {
      const req = rows.find((row) => row.kind === JOURNEY_ACTIVITY.LISTING_SHOWING_REQUESTED) || rows[0];
      return { reason: 'Agent innej agencji poprosił o prezentację dla swojego kupującego', at: iso(req?.createdAt) || iso(deal.createdAt) || null, qualified: true };
    }
    case 'guest_agency':
      return {
        reason: `${deal.externalAgency || 'Inna agencja'} umawia prezentację dla swojego kupującego`,
        at: iso(firstSchedule?.createdAt) || iso(deal.createdAt) || null,
        qualified: true,
      };
    case 'presentation':
      return scheduleEntry() || { reason: 'Prezentacja przy tej ofercie', at: iso(deal.createdAt) || null, qualified: true };
    case 'manual':
      return { reason: 'Dodany ręcznie przez agenta', at: iso(deal.createdAt) || null, qualified: true };
    case 'dealroom':
      return { reason: 'Otwarta rozmowa w Dealroomie (portal)', at: iso(deal.createdAt) || null, qualified: true };
    default:
      return { reason: SOURCE_LABELS[deal.source] || 'Kupujący przy ofercie', at: iso(deal.createdAt) || null, qualified: true };
  }
}

const VIEW_WORDS = /obejrz|ogl[aą]d|wizyt|prezentac|zobaczy|pokaz|spotka/i;

function firstName(full: string | null | undefined): string {
  return String(full || '').trim().split(/\s+/)[0] || 'Kupujący';
}

/** Co się stało i co agent ma zrobić — przed prezentacją (Zainteresowani / Umawianie). */
function dealGuide(
  deal: DealRow,
  stage: DealStage,
  entry: DealView['entry'],
  presentation: DealView['presentation'],
  rows: ActivityRow[],
  parsed: ReturnType<typeof parseClientOfferFeedback>,
  data: DealData,
  buyerLabel: string,
  sellerName: string | null,
): DealGuide | null {
  if (stage !== 'interested' && stage !== 'scheduling') return null;
  const who = firstName(buyerLabel);
  const owner = sellerName ? `właściciela (${sellerName})` : 'właściciela';

  // Ostatnia wiadomość kupującego: Dealroom albo zapytanie z portalu.
  const dealroomMsg = [...(data.dealroom?.events || [])].reverse().find((e) => e.actor === 'buyer' && e.text.startsWith('Kupujący napisał'));
  const lead = [...rows].reverse().find((row) => row.kind === 'EXTERNAL_PORTAL_LEAD');
  const lastMessage = dealroomMsg
    ? { text: dealroomMsg.text.replace(/^Kupujący napisał:\s*/, ''), at: dealroomMsg.at }
    : lead && (lead.body || lead.title)
      ? { text: `„${clip(lead.body || lead.title, 240)}”`, at: iso(lead.createdAt) || '' }
      : parsed.note
        ? { text: `„${clip(parsed.note, 240)}”`, at: entry.at || '' }
        : null;
  const buyerProposedInDealroom = (data.dealroom?.events || []).some((e) => e.actor === 'buyer' && e.text.startsWith('Termin w Dealroomie'));

  const wants =
    Boolean(data.intent?.confirmedAt) ||
    parsed.sentiment === 'like' ||
    deal.source === 'listing_request' ||
    deal.source === 'guest_agency' ||
    buyerProposedInDealroom ||
    presentation?.proposedBy === 'client' ||
    Boolean(lastMessage && VIEW_WORDS.test(lastMessage.text));

  // 1) Kupujący sam zaproponował termin — sprawdź z właścicielem i potwierdź.
  if (stage === 'scheduling' && presentation?.proposedBy === 'client') {
    return {
      intent: 'wants',
      headline: `${who} proponuje termin — sprawdź z właścicielem`,
      story: `${entry.reason}. kupujący zaproponował termin prezentacji. Zanim potwierdzisz, upewnij się, że ${owner} może wtedy pokazać nieruchomość.`,
      lastMessage,
      steps: [
        { title: `Zadzwoń do ${owner}`, detail: 'Zapytaj, czy termin proponowany przez kupującego pasuje.', contact: 'seller', action: null },
        { title: 'Potwierdź termin kupującemu', detail: 'Jeśli właściciel nie może — zaproponuj inne terminy od niego.', contact: null, action: 'accept_client_slot' },
      ],
    };
  }

  // 2) Terminy wysłane — czekamy na wybór kupującego.
  if (stage === 'scheduling') {
    return {
      intent: 'wants',
      headline: `Czekamy, aż ${who} wybierze termin`,
      story: `Terminy prezentacji zostały wysłane. ${who} wybiera jeden w swoim panelu — dostanie przypomnienie.`,
      lastMessage,
      steps: [
        { title: `Jeśli długo cisza — zadzwoń do kupującego (${buyerLabel})`, detail: 'Przypomnij o terminach albo ustal inny, który pasuje obu stronom.', contact: 'buyer', action: 'remind_buyer' },
      ],
    };
  }

  if (!wants) {
    const what =
      deal.source === 'dealroom'
        ? lastMessage
          ? 'Kupujący napisał w Dealroomie, ale z wiadomości nie wynika jasno, że chce oglądać.'
          : 'Kupujący otworzył rozmowę w Dealroomie przy tej ofercie — bez żadnej wiadomości i bez prośby o prezentację.'
        : parsed.sentiment === 'maybe'
          ? 'Odpowiedź „Do przemyślenia” — oferta zainteresowała, ale kupujący nie jest pewny.'
          : `${entry.reason}. To zainteresowanie, ale jeszcze nie prośba o prezentację.`;
    return {
      intent: 'unclear',
      headline: `Najpierw upewnij się, czy ${who} chce obejrzeć`,
      story: `${what} Nie dzwoń jeszcze do właściciela — najpierw potwierdź z kupującym.`,
      lastMessage,
      steps: [
        {
          title: `Zadzwoń do kupującego (${buyerLabel})`,
          detail: 'Zapytaj, czy chce obejrzeć nieruchomość i jakie dni/godziny mu pasują. Odpowiedz też na pytania o ofertę.',
          contact: 'buyer',
          action: 'confirm_intent',
        },
      ],
    };
  }

  const why = data.intent?.confirmedAt
    ? `Potwierdzone telefonicznie: kupujący chce obejrzeć${data.intent.note ? ` (pasuje: ${data.intent.note})` : ''}.`
    : parsed.sentiment === 'like'
      ? 'Kupujący kliknął „Chcę obejrzeć” przy ofercie od agenta poszukiwań.'
      : deal.source === 'listing_request' || deal.source === 'guest_agency'
        ? `Agent innej agencji chce pokazać tę nieruchomość swojemu kupującemu.`
        : buyerProposedInDealroom
          ? 'Kupujący zaproponował termin w Dealroomie.'
          : 'Kupujący napisał, że chce obejrzeć.';
  return {
    intent: 'wants',
    headline: sellerName ? `${who} chce obejrzeć — zadzwoń do właściciela` : `${who} chce obejrzeć — ustal termin`,
    story: `${why} Teraz ustal z ${sellerName ? 'właścicielem' : 'dostępnością nieruchomości'}, kiedy można pokazać, i przekaż terminy kupującemu.`,
    lastMessage,
    steps: [
      sellerName
        ? { title: `Zadzwoń do ${owner}`, detail: `Zapytaj, kiedy może pokazać nieruchomość${data.intent?.note ? ` — kupującemu pasuje: ${data.intent.note}` : ''}.`, contact: 'seller', action: null }
        : { title: 'Sprawdź, kiedy nieruchomość jest dostępna', detail: 'Brak sprzedającego w CRM — ustal dostępność samodzielnie.', contact: null, action: null },
      {
        title: 'Wpisz terminy i wyślij kupującemu',
        detail: deal.buyerClientId
          ? 'Kupujący wybierze jeden w swoim panelu.'
          : deal.source === 'dealroom'
            ? 'Termin trafi do kupującego w rozmowie w Dealroomie.'
            : 'Zapisz uzgodniony termin.',
        contact: null,
        action: 'schedule',
      },
    ],
  };
}

function shapeDeal(deal: DealRow, ctx: Context): DealView {
  const now = Date.now();
  const rows = activitiesForDeal(deal, ctx.activities.filter((row) => row.offerId === deal.offerId));
  const slot: ScheduleSlot | null = resolvePresentation(rows.filter((row) => SCHEDULE_KINDS.includes(row.kind)));
  const heldAt = slot?.heldAt || iso(deal.viewedAt);
  const startsAt = slot?.startsAt || iso(deal.scheduledAt);

  const presentation: DealView['presentation'] = startsAt
    ? {
        startsAt,
        status: slot ? slot.status : 'confirmed',
        proposedBy: slot?.proposedBy === 'client' ? 'client' : 'agent',
        proposedSlots: slot?.proposedSlots?.length ? slot.proposedSlots : [startsAt],
        heldAt,
        past: new Date(startsAt).getTime() < now,
      }
    : heldAt
      ? { startsAt: heldAt, status: 'confirmed', proposedBy: 'agent', proposedSlots: [heldAt], heldAt, past: true }
      : null;

  const heldRow = latest(rows, JOURNEY_ACTIVITY.PRESENTATION_HELD);
  const slip = asMeta(asMeta(heldRow?.metadata).attendanceSlip);
  const attendance: DealView['attendance'] = deal.attendanceUrl
    ? { signed: true, via: 'scan', documentId: null, url: deal.attendanceUrl, name: deal.attendanceName, at: iso(deal.attendanceAt) }
    : slip.documentId
      ? { signed: true, via: 'tablet', documentId: String(slip.documentId), url: null, name: null, at: iso(String(slip.signedAt || '')) }
      : { signed: false, via: null, documentId: null, url: null, name: null, at: null };

  // Opinia: najnowsza z trzech źródeł — panel kupującego, podsumowanie wizyty na tablecie, wpis agenta.
  const candidates: NonNullable<DealView['feedback']>[] = [];
  let matchFeedback: { text: string; at: string } | null = null;
  const match = deal.buyerClientId
    ? ctx.matches.find((row) => row.clientId === deal.buyerClientId && row.offerId === deal.offerId)
    : undefined;
  const matchParsed = parseClientOfferFeedback(match?.clientFeedback);
  if (deal.buyerClientId) {
    const parsed = matchParsed;
    const at = iso(match?.clientFeedbackAt) || null;
    // Reakcja przed prezentacją („Chcę obejrzeć”) to powód wejścia do lejka, a nie opinia po obejrzeniu.
    const afterViewing = Boolean(heldAt && (!at || new Date(at).getTime() >= new Date(heldAt).getTime()));
    if (parsed.sentiment && afterViewing) {
      const note = [parsed.liked, parsed.disliked, parsed.phrases.join(', '), parsed.note].filter(Boolean).join(' · ') || null;
      candidates.push({ sentiment: parsed.sentiment, note, by: 'buyer', at });
      if (at) matchFeedback = { at, text: `Opinia w panelu: ${SENTIMENT_LABEL[parsed.sentiment]}${note ? ` — ${note}` : ''}` };
    }
  }
  const debrief = latest(rows, 'PRESENTATION_DEBRIEF');
  const debriefSentiment = sentimentFromOutcome(asMeta(debrief?.metadata).outcome);
  if (debrief && debriefSentiment) {
    const meta = asMeta(debrief.metadata);
    const note = [meta.priceHint, meta.liked, meta.disliked].filter(Boolean).map(String).join(' · ') || null;
    candidates.push({ sentiment: debriefSentiment, note, by: 'agent', at: iso(debrief.createdAt) });
  }
  if (deal.feedbackSentiment && ['like', 'maybe', 'dislike'].includes(deal.feedbackSentiment)) {
    candidates.push({ sentiment: deal.feedbackSentiment as DealSentiment, note: deal.feedbackNote, by: 'agent', at: iso(deal.feedbackAt) });
  }
  const feedback = candidates.sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())[0] || null;

  const status = (['ACTIVE', 'PAUSED', 'LOST', 'WON'].includes(deal.status) ? deal.status : 'ACTIVE') as DealStatus;
  const data = parseData(deal.data);
  const neg = data.negotiation || {};
  const tx = data.transaction || {};
  const sellerMerge = mergeSellerResponses(neg.offers || [], ctx);
  const offers = sellerMerge.offers;
  const acceptedOffer = [...offers].reverse().find((offer) => offer.status === 'accepted') || null;
  const agreedPrice = neg.agreedPrice ?? acceptedOffer?.amount ?? null;
  const reservationActive = Boolean(neg.reservation && new Date(neg.reservation.until).getTime() > now);
  const negotiationStarted = Boolean(neg.startedAt || offers.length || neg.financing);

  const stage: DealStage =
    status === 'LOST'
      ? 'lost'
      : tx.handover?.done
        ? 'closed'
        : tx.deed?.done
          ? 'deed'
          : tx.preliminary?.done
            ? 'preliminary'
            : reservationActive
              ? 'reserved'
              : negotiationStarted
                ? 'negotiation'
                : feedback
                  ? 'feedback'
                  : heldAt
                    ? 'viewed'
                    : presentation?.status === 'confirmed'
                      ? now >= new Date(presentation.startsAt).getTime() && now < new Date(presentation.startsAt).getTime() + PRESENTATION_LIVE_MS
                        ? 'live'
                        : 'scheduled'
                      : presentation
                        ? 'scheduling'
                        : 'interested';

  const negotiationDone = Boolean(agreedPrice || reservationActive || tx.preliminary?.done || tx.deed?.done);
  const reservationDone = Boolean(tx.preliminary?.done || tx.deed?.done || (negotiationDone && neg.reservationSkipped));
  const transactionDone = Boolean(tx.handover?.done);
  const presentationSkipped = negotiationStarted && !heldAt;
  const feedbackSkipped = negotiationStarted && !feedback;
  const phaseDone = [
    Boolean(heldAt) || presentationSkipped,
    Boolean(feedback) || feedbackSkipped,
    negotiationDone,
    reservationDone,
    transactionDone,
  ];
  const firstOpen = phaseDone.findIndex((done) => !done);
  const labels = ['Prezentacja', 'Opinia', 'Negocjacje', 'Rezerwacja', 'Transakcja'] as const;
  const ids = ['presentation', 'feedback', 'negotiation', 'reservation', 'transaction'] as const;
  const summaries: Array<string | null> = [
    heldAt ? `${day(heldAt)} ✓${attendanceSigned(deal, rows) ? ' · podpisane' : ''}` : presentationSkipped ? 'pominięta' : null,
    feedback ? `${SENTIMENT_LABEL[feedback.sentiment]}${feedback.note ? ` · ${feedback.note.slice(0, 60)}` : ''}` : feedbackSkipped ? 'pominięta' : null,
    agreedPrice ? `uzgodniono ${pln(agreedPrice)}` : null,
    neg.reservation ? `do ${day(neg.reservation.until)}` : neg.reservationSkipped ? 'bez rezerwacji' : null,
    transactionDone ? `klucze ${day(tx.handover?.doneAt || tx.handover?.date || new Date().toISOString())} ✓` : null,
  ];
  const phases = ids.map((id, index) => ({
    id,
    label: labels[index],
    done: phaseDone[index],
    current: status !== 'LOST' && index === firstOpen,
    skipped: (index === 0 && presentationSkipped) || (index === 1 && feedbackSkipped),
    summary: phaseDone[index] ? summaries[index] : null,
  }));
  const turn = negotiationTurn(offers, Boolean(agreedPrice), Boolean(deal.sellerClientId), Boolean(deal.buyerClientId));

  const lastOpen = [...offers].reverse().find((offer) => offer.status === 'open') || null;
  const nextAction = (() => {
    if (status === 'LOST') return data.searchOther?.wanted ? 'Nie pasuje — szukamy dla niego czegoś innego' : 'Zakończone — kupujący zrezygnował';
    if (status === 'PAUSED') return 'Wstrzymane';
    if (stage === 'closed') return tx.commission?.done ? 'Transakcja zakończona, prowizja rozliczona' : 'Klucze przekazane — rozlicz prowizję';
    if (stage === 'deed') return tx.handover?.date ? `Przekazanie kluczy ${when(tx.handover.date)}` : 'Akt podpisany — ustal przekazanie kluczy';
    if (stage === 'preliminary') {
      const deedAt = tx.deed?.date || neg.terms?.deedAt;
      return deedAt ? `Akt notarialny ${when(deedAt)}` : 'Umowa przedwstępna podpisana — ustal termin aktu';
    }
    if (stage === 'reserved') {
      const prelimAt = tx.preliminary?.date || neg.terms?.preliminaryAt;
      return prelimAt ? `Umowa przedwstępna ${when(prelimAt)}` : `Rezerwacja do ${day(neg.reservation!.until)} — umów umowę przedwstępną`;
    }
    if (stage === 'negotiation') {
      if (agreedPrice) return `Cena uzgodniona: ${pln(agreedPrice)} — ustal rezerwację albo przejdź do umowy`;
      return turn.label;
    }
    if (stage === 'live') return 'Prezentacja trwa — po wizycie oznacz ją jako odbytą';
    if (stage === 'interested') return 'Umów prezentację';
    if (stage === 'scheduling') {
      return presentation?.proposedBy === 'client' ? 'Kupujący proponuje termin — potwierdź' : 'Czekamy, aż kupujący wybierze termin';
    }
    if (stage === 'scheduled') return presentation?.past ? 'Oznacz prezentację jako odbytą' : `Prezentacja ${when(presentation!.startsAt)}`;
    if (stage === 'viewed') return deal.feedbackRequestedAt ? 'Czekamy na opinię kupującego' : 'Zbierz opinię kupującego';
    if (feedback?.sentiment === 'dislike') return 'Nie pasuje — zapytaj, czy szukamy czegoś innego';
    if (!deal.sellerInformedAt && deal.sellerClientId) return 'Przekaż opinię sprzedającemu';
    if (feedback?.sentiment === 'maybe') return 'Zastanawia się — dopytaj za kilka dni';
    return 'Klient kupuje? Przejdź do negocjacji';
  })();

  const entry = dealEntry(deal, rows, slot, match, matchParsed);

  const offer = ctx.offers.get(deal.offerId);
  const sellerRow = deal.sellerClientId ? ctx.clients.get(deal.sellerClientId) : null;
  const buyerRow = deal.buyerClientId ? ctx.clients.get(deal.buyerClientId) : null;
  const otherAgencyClientId = deal.externalKey?.startsWith('agent:') ? Number(deal.externalKey.slice(6)) : null;
  const otherAgentUserId = otherAgencyClientId
    ? ctx.activities.find((row) => row.clientId === otherAgencyClientId)?.agencyUserId
    : null;

  const buyerLabel = buyerRow ? `${buyerRow.firstName} ${buyerRow.lastName}`.trim() : deal.externalName || deal.externalAgency || 'Kupujący';
  const guide =
    status === 'ACTIVE' || status === 'PAUSED'
      ? dealGuide(deal, stage, entry, presentation, rows, matchParsed, data, buyerLabel, sellerRow ? `${sellerRow.firstName} ${sellerRow.lastName}`.trim() : null)
      : null;

  return {
    id: deal.id,
    offerId: deal.offerId,
    status,
    source: deal.source,
    sourceLabel: SOURCE_LABELS[deal.source] || 'Kupujący',
    offer: {
      id: deal.offerId,
      title: offer?.title || `Oferta #${deal.offerId}`,
      address: offer ? [offer.street, offer.district !== 'OTHER' ? offer.district : null, offer.city].filter(Boolean).join(', ') : '',
      price: offer?.price ?? null,
      imageUrl: offer ? resolveOfferPrimaryImage(offer) || null : null,
    },
    seller: deal.sellerClientId && sellerRow
      ? { clientId: deal.sellerClientId, name: `${sellerRow.firstName} ${sellerRow.lastName}`.trim(), phone: sellerRow.phone, email: sellerRow.email }
      : null,
    buyer:
      deal.buyerClientId && buyerRow
        ? {
            kind: 'client',
            clientId: deal.buyerClientId,
            name: `${buyerRow.firstName} ${buyerRow.lastName}`.trim(),
            phone: buyerRow.phone,
            email: buyerRow.email,
          }
        : {
            kind: 'external',
            agency: deal.externalAgency || (otherAgentUserId ? ctx.agencies.get(otherAgentUserId) || null : null),
            name: deal.externalName,
            phone: deal.externalPhone,
            email: deal.externalEmail,
          },
    stage,
    entry,
    guide,
    phases,
    presentation,
    attendance,
    feedback,
    feedbackRequestedAt: iso(deal.feedbackRequestedAt),
    sellerInformedAt: iso(deal.sellerInformedAt),
    searchOther: data.searchOther ?? null,
    negotiation: { ...neg, offers, agreedPrice },
    turn,
    transaction: tx,
    documentsVisible: Boolean(agreedPrice || reservationActive || tx.documentsStartedAt || stage === 'preliminary' || stage === 'deed' || stage === 'closed'),
    nextAction,
    timeline: buildTimeline(rows, deal, matchFeedback, [...sellerMerge.events, ...(parseData(deal.data).dealroom?.events || [])]),
    updatedAt: deal.updatedAt.toISOString(),
  };
}

async function buildContext(deals: DealRow[]): Promise<Context> {
  const offerIds = [...new Set(deals.map((deal) => deal.offerId))];
  const clientIds = [
    ...new Set(deals.flatMap((deal) => [deal.buyerClientId, deal.sellerClientId]).filter((id): id is number => Boolean(id))),
  ];
  const buyerIds = [...new Set(deals.map((deal) => deal.buyerClientId).filter((id): id is number => Boolean(id)))];
  const [activities, matches, clients, offers] = await Promise.all([
    offerIds.length
      ? prisma.agencyClientActivity.findMany({
          where: { offerId: { in: offerIds }, kind: { in: TRACKED_KINDS } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, clientId: true, agencyUserId: true, kind: true, title: true, body: true, createdAt: true, offerId: true, metadata: true },
        })
      : [],
    buyerIds.length
      ? prisma.agencyClientMatch.findMany({
          where: { clientId: { in: buyerIds }, offerId: { in: offerIds } },
          select: { clientId: true, offerId: true, clientFeedback: true, clientFeedbackAt: true, clientFavorite: true, favoriteAt: true },
        })
      : [],
    clientIds.length
      ? prisma.agencyClient.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        })
      : [],
    offerIds.length
      ? prisma.offer.findMany({
          where: { id: { in: offerIds } },
          select: { id: true, title: true, street: true, district: true, city: true, price: true, images: true },
        })
      : [],
  ]);
  const sellerOfferIds = deals.flatMap((deal) =>
    (parseData(deal.data).negotiation?.offers || []).map((offer) => offer.sellerBuyerOfferId).filter((id): id is number => Boolean(id)),
  );
  const sellerOffers = sellerOfferIds.length
    ? await prisma.sellerBuyerOffer.findMany({
        where: { id: { in: sellerOfferIds } },
        select: { id: true, status: true, clientResponse: true, counterAmount: true, clientComment: true, updatedAt: true },
      })
    : [];
  const agentIds = [...new Set(activities.map((row) => row.agencyUserId))];
  const agents = agentIds.length
    ? await prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true, companyName: true } })
    : [];
  return {
    activities,
    matches,
    clients: new Map(clients.map((row) => [row.id, row])),
    offers: new Map(offers.map((row) => [row.id, row])),
    agencies: new Map(agents.map((row) => [row.id, row.companyName || row.name || 'Inna agencja'])),
    sellerOffers: new Map(sellerOffers.map((row) => [row.id, row])),
  };
}

function shapeAll(deals: DealRow[], ctx: Context): DealView[] {
  return deals.map((deal) => shapeDeal(deal, ctx));
}

const STAGE_ORDER: Record<DealStage, number> = {
  live: -1,
  deed: 0,
  preliminary: 1,
  reserved: 2,
  negotiation: 3,
  feedback: 4,
  viewed: 5,
  scheduled: 6,
  scheduling: 7,
  interested: 8,
  closed: 9,
  lost: 10,
};

function sortDeals(views: DealView[]): DealView[] {
  return views.sort((a, b) => {
    const pausedA = a.status === 'PAUSED' ? 1 : 0;
    const pausedB = b.status === 'PAUSED' ? 1 : 0;
    if (pausedA !== pausedB) return pausedA - pausedB;
    if (STAGE_ORDER[a.stage] !== STAGE_ORDER[b.stage]) return STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage];
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

/* ───────────────────────── odczyt dla aplikacji ───────────────────────── */

export async function listOfferBuyerDeals(agencyUserId: number, offerId: number): Promise<DealView[]> {
  await syncOfferBuyerDeals(agencyUserId, offerId);
  const deals = await prisma.offerBuyerDeal.findMany({ where: { agencyUserId, offerId } });
  return sortDeals(shapeAll(deals, await buildContext(deals)));
}

/**
 * Cały lejek transakcji agenta (zakładka Transakcje): aktywne ścieżki kupujących + zakończone z ostatnich 90 dni.
 * Najpierw dociąga Dealroom i nowych kupujących dla ofert, przy których coś się dzieje.
 */
export async function listAgentDeals(agencyUserId: number): Promise<DealView[]> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const touched = await prisma.deal.findMany({
    where: { updatedAt: { gte: since }, offer: { userId: agencyUserId } },
    select: { offerId: true },
    distinct: ['offerId'],
    take: 60,
  });
  for (const row of touched) {
    await syncOfferBuyerDeals(agencyUserId, row.offerId).catch(() => null);
  }
  const deals = await prisma.offerBuyerDeal.findMany({
    where: {
      agencyUserId,
      OR: [{ status: { in: ['ACTIVE', 'PAUSED'] } }, { updatedAt: { gte: since } }],
    },
    orderBy: { updatedAt: 'desc' },
    take: 300,
  });
  const views = shapeAll(deals, await buildContext(deals));
  // Reakcje z agenta poszukiwań trafiają do lejka tylko przy aktywnym Smart Agent OS™ i wg ustawień agenta.
  const [access, triggers] = await Promise.all([getSmartAgentAccess(agencyUserId), getSmartAgentTriggers(agencyUserId)]);
  const radarAllowed = (view: DealView) => {
    const signal = view.entry.signal;
    if (!signal) return true;
    return access.active && Boolean(triggers[signal]);
  };
  return sortDeals(
    views.filter((view) => {
      if (view.stage !== 'interested') return true;
      if (!view.entry.qualified) return false;
      return view.source !== 'radar' || radarAllowed(view);
    }),
  );
}

/** Nieruchomości, przy których kupujący jest w procesie (karta kupującego). Samo wysłanie z radaru pomijamy. */
export async function listBuyerClientDeals(agencyUserId: number, buyerClientId: number): Promise<DealView[]> {
  await syncBuyerClientDeals(agencyUserId, buyerClientId);
  const deals = await prisma.offerBuyerDeal.findMany({ where: { agencyUserId, buyerClientId } });
  const views = shapeAll(deals, await buildContext(deals));
  return sortDeals(views.filter((view) => view.stage !== 'interested' || view.source !== 'radar'));
}

export async function getDeal(agencyUserId: number, dealId: number): Promise<DealView | null> {
  const deal = await prisma.offerBuyerDeal.findFirst({ where: { id: dealId, agencyUserId } });
  if (!deal) return null;
  return shapeAll([deal], await buildContext([deal]))[0];
}

/* ───────────────────────── działania agenta ───────────────────────── */

export async function ownedDeal(agencyUserId: number, dealId: number) {
  const deal = await prisma.offerBuyerDeal.findFirst({ where: { id: dealId, agencyUserId } });
  if (!deal) throw new Error('Nie znaleziono kupującego przy tej ofercie.');
  return deal;
}

export async function addBuyerToOffer(params: {
  agencyUserId: number;
  offerId: number;
  buyerClientId?: number | null;
  newBuyer?: { firstName: string; lastName: string; phone?: string | null; email?: string | null } | null;
  external?: { agency?: string | null; name?: string | null; phone?: string | null; email?: string | null } | null;
}): Promise<number> {
  const seller = await sellerClientFor(params.agencyUserId, params.offerId);
  let buyerClientId = positiveId(params.buyerClientId);
  if (buyerClientId) {
    const owned = await prisma.agencyClient.count({ where: { id: buyerClientId, agencyUserId: params.agencyUserId } });
    if (!owned) throw new Error('Nie znaleziono kupującego.');
  }
  if (!buyerClientId && params.newBuyer) {
    const firstName = String(params.newBuyer.firstName || '').trim().slice(0, 96);
    const lastName = String(params.newBuyer.lastName || '').trim().slice(0, 96);
    if (!firstName) throw new Error('Podaj imię kupującego.');
    const created = await prisma.agencyClient.create({
      data: {
        agencyUserId: params.agencyUserId,
        type: 'BUYER',
        firstName,
        lastName,
        phone: String(params.newBuyer.phone || '').trim().slice(0, 32) || null,
        email: String(params.newBuyer.email || '').trim().toLowerCase().slice(0, 191) || null,
      },
      select: { id: true },
    });
    buyerClientId = created.id;
  }
  if (buyerClientId) {
    const deal = await prisma.offerBuyerDeal.upsert({
      where: { offerId_buyerClientId: { offerId: params.offerId, buyerClientId } },
      create: {
        agencyUserId: params.agencyUserId,
        offerId: params.offerId,
        sellerClientId: seller?.id ?? null,
        buyerClientId,
        source: 'manual',
        data: withEvent(null, { actor: 'agent', text: 'Dodany do oferty' }),
      },
      update: { status: 'ACTIVE' },
      select: { id: true },
    });
    return deal.id;
  }
  const external = params.external;
  const agency = String(external?.agency || '').trim().slice(0, 160) || null;
  const name = String(external?.name || '').trim().slice(0, 160) || null;
  if (!agency && !name) throw new Error('Podaj nazwę agencji albo imię kupującego.');
  const created = await prisma.offerBuyerDeal.create({
    data: {
      agencyUserId: params.agencyUserId,
      offerId: params.offerId,
      sellerClientId: seller?.id ?? null,
      externalKey: `manual:${Date.now().toString(36)}${Math.round(Math.random() * 1e4).toString(36)}`,
      externalAgency: agency,
      externalName: name,
      externalPhone: String(external?.phone || '').trim().slice(0, 32) || null,
      externalEmail: String(external?.email || '').trim().toLowerCase().slice(0, 191) || null,
      source: agency ? 'guest_agency' : 'manual',
      data: withEvent(null, { actor: 'agent', text: 'Dodany do oferty' }),
    },
    select: { id: true },
  });
  return created.id;
}

export async function updateExternalBuyer(params: {
  agencyUserId: number;
  dealId: number;
  agency?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  if (deal.buyerClientId) throw new Error('To kupujący z Twojego CRM — zmień dane na jego karcie.');
  await prisma.offerBuyerDeal.update({
    where: { id: deal.id },
    data: {
      externalAgency: String(params.agency || '').trim().slice(0, 160) || null,
      externalName: String(params.name || '').trim().slice(0, 160) || null,
      externalPhone: String(params.phone || '').trim().slice(0, 32) || null,
      externalEmail: String(params.email || '').trim().toLowerCase().slice(0, 191) || null,
    },
  });
}

/** Termin dla kupującego spoza CRM (kupujący z CRM dostaje termin przez zwykłą propozycję prezentacji). */
export async function confirmBuyerIntent(params: { agencyUserId: number; dealId: number; note: string | null }) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  const note = params.note ? params.note.trim().slice(0, 200) || null : null;
  await prisma.offerBuyerDeal.update({
    where: { id: deal.id },
    data: {
      data: withEvent(
        deal.data,
        { actor: 'agent', text: `Kupujący potwierdził, że chce obejrzeć${note ? ` · pasuje: ${note}` : ''}` },
        new Date(),
        (d) => ({ ...d, intent: { confirmedAt: new Date().toISOString(), note } }),
      ),
    },
  });
}

export async function scheduleExternalViewing(params: { agencyUserId: number; dealId: number; startsAt: Date }) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  if (deal.buyerClientId) throw new Error('Termin dla kupującego z CRM ustal w jego karcie.');
  // Kupujący z Dealroomu dostaje termin w swojej rozmowie.
  const dealroomId = parseData(deal.data).dealroom?.dealId;
  if (dealroomId) {
    const room = await prisma.deal.findUnique({ where: { id: dealroomId }, select: { id: true, sellerId: true, buyerId: true } });
    if (room && room.sellerId === params.agencyUserId) {
      await prisma.dealMessage.create({
        data: {
          dealId: room.id,
          senderId: params.agencyUserId,
          content: `Proponuję prezentację: ${when(params.startsAt)}. Proszę o potwierdzenie, że termin pasuje.`,
        },
      });
    }
  }
  await prisma.offerBuyerDeal.update({
    where: { id: deal.id },
    data: {
      scheduledAt: params.startsAt,
      data: withEvent(deal.data, { actor: 'agent', text: `Ustalono termin: ${when(params.startsAt)}` }),
    },
  });
}

export async function markDealViewed(params: { agencyUserId: number; dealId: number }) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  const heldAt = new Date();
  if (deal.buyerClientId) {
    const activities = await prisma.agencyClientActivity.findMany({
      where: { clientId: deal.buyerClientId, offerId: deal.offerId, kind: { in: SCHEDULE_KINDS } },
      orderBy: { createdAt: 'asc' },
    });
    const slot = resolvePresentation(activities);
    if (!slot?.heldAt) {
      // Ten sam wpis, który zapisuje „Oznacz prezentację jako odbytą” na karcie kupującego.
      await prisma.agencyClientActivity.create({
        data: {
          clientId: deal.buyerClientId,
          agencyUserId: params.agencyUserId,
          offerId: deal.offerId,
          kind: JOURNEY_ACTIVITY.PRESENTATION_HELD,
          title: `Prezentacja odbyta · #${deal.offerId}`,
          body: (slot ? new Date(slot.startsAt) : heldAt).toLocaleString('pl-PL'),
          metadata: {
            startsAt: slot?.startsAt || heldAt.toISOString(),
            proposedSlots: slot?.proposedSlots || [heldAt.toISOString()],
            heldAt: heldAt.toISOString(),
            offerId: deal.offerId,
            buyerClientId: deal.buyerClientId,
            sellerClientId: deal.sellerClientId,
            status: 'confirmed',
          },
        },
      });
    }
  }
  await prisma.offerBuyerDeal.update({ where: { id: deal.id }, data: { viewedAt: deal.viewedAt ?? heldAt } });
}

export async function attachDealAttendance(params: { agencyUserId: number; dealId: number; url: string; name: string }) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  const now = new Date();
  await prisma.offerBuyerDeal.update({
    where: { id: deal.id },
    data: {
      attendanceUrl: params.url.slice(0, 500),
      attendanceName: params.name.slice(0, 200),
      attendanceAt: now,
      viewedAt: deal.viewedAt ?? now,
      data: withEvent(deal.data, { actor: 'agent', text: 'Wgrano podpisane potwierdzenie prezentacji' }, now),
    },
  });
}

export async function setDealFeedback(params: { agencyUserId: number; dealId: number; sentiment: DealSentiment; note?: string | null }) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  const note = String(params.note || '').trim().slice(0, 2000) || null;
  const now = new Date();
  await prisma.offerBuyerDeal.update({
    where: { id: deal.id },
    data: {
      feedbackSentiment: params.sentiment,
      feedbackNote: note,
      feedbackAt: now,
      viewedAt: deal.viewedAt ?? now,
      data: withEvent(deal.data, { actor: 'agent', text: `Opinia kupującego: ${SENTIMENT_LABEL[params.sentiment]}${note ? ` — ${note}` : ''}` }, now),
    },
  });
}

export async function setDealStatus(params: {
  agencyUserId: number;
  dealId: number;
  status: DealStatus;
  searchOther?: boolean;
  searchNote?: string | null;
}) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  const now = new Date();
  const data = parseData(deal.data);
  const searchOther =
    params.status === 'LOST' && params.searchOther !== undefined
      ? { wanted: params.searchOther, note: String(params.searchNote || '').trim().slice(0, 1000) || null, at: now.toISOString() }
      : data.searchOther ?? null;
  const label =
    params.status === 'LOST'
      ? `Zakończone — nie pasuje${searchOther?.wanted ? `. Szukamy czegoś innego${searchOther.note ? `: ${searchOther.note}` : ''}` : ''}`
      : params.status === 'PAUSED'
        ? 'Wstrzymane'
        : 'Wznowione';
  const withLog = asMeta(withEvent(deal.data, { actor: 'agent', text: label }, now));
  await prisma.offerBuyerDeal.update({
    where: { id: deal.id },
    data: { status: params.status, data: { ...withLog, searchOther } as Prisma.InputJsonValue },
  });
  if (searchOther?.wanted && searchOther.note && deal.buyerClientId) {
    const buyer = await prisma.agencyClient.findUnique({ where: { id: deal.buyerClientId }, select: { notes: true } });
    await prisma.agencyClient.update({
      where: { id: deal.buyerClientId },
      data: { notes: [buyer?.notes, `Szukamy dalej (po #${deal.offerId}): ${searchOther.note}`].filter(Boolean).join('\n').slice(0, 4000) },
    });
  }
}

/* ───────────────────── wiadomości — zawsze przez akceptację agenta ───────────────────── */

export async function requestBuyerFeedback(params: { agencyUserId: number; dealId: number }) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  if (!deal.buyerClientId) throw new Error('Kupujący spoza CRM — zapytaj jego agencję telefonicznie albo mailem.');
  const buyer = await prisma.agencyClient.findFirst({
    where: { id: deal.buyerClientId, agencyUserId: params.agencyUserId },
    select: { id: true, firstName: true, salutation: true, email: true, portalToken: true, linkedUserId: true, agencyUser: { select: { name: true, email: true } } },
  });
  if (!buyer) throw new Error('Nie znaleziono kupującego.');
  const offer = await prisma.offer.findUnique({ where: { id: deal.offerId }, select: { title: true, street: true, district: true, city: true } });
  const offerAddress = offer ? [offer.street, offer.district !== 'OTHER' ? offer.district : null, offer.city].filter(Boolean).join(', ') : '';
  const { deliverToClient, emailStep } = await import('@/lib/crm/clientOutbox');
  const { buildPortalUrl } = await import('@/lib/agencyClientNotify');
  const { buildClientVoice, withChatLead } = await import('@/lib/crm/clientVoice');
  const { buildClientMessageEmailHtml } = await import('@/lib/crm/clientMessageEmail');
  const voice = buildClientVoice({ clientId: buyer.id, firstName: buyer.firstName, salutation: buyer.salutation, agentName: buyer.agencyUser?.name });
  const title = offer?.title || `Oferta #${deal.offerId}`;
  const portalUrl = buyer.portalToken ? buildPortalUrl(buyer.portalToken) : null;
  const question = `Jak wrażenia po oglądaniu „${title}”? Podoba się, zastanawia czy raczej nie pasuje? Wystarczy jedno kliknięcie w panelu — każda uwaga pomoże mi w dalszych poszukiwaniach.`;
  const steps: Parameters<typeof deliverToClient>[0]['steps'] = [
    {
      kind: 'chat',
      params: {
        clientId: buyer.id,
        agencyUserId: params.agencyUserId,
        linkedUserId: buyer.linkedUserId,
        from: 'agent',
        content: withChatLead(voice, question),
        activityMetadata: { offerId: deal.offerId, kind: 'feedback_request' },
      },
    },
  ];
  if (portalUrl) steps.push({ kind: 'push', clientId: buyer.id, payload: { title: 'Jak wrażenia po oglądaniu?', body: title, tag: `feedback-${deal.id}`, url: portalUrl } });
  if (buyer.email) {
    const html = await buildClientMessageEmailHtml({
      agencyUserId: params.agencyUserId,
      client: buyer,
      eyebrow: 'Po oglądaniu',
      title: 'Jak wrażenia?',
      paragraphs: [
        'Dziękuję za wspólne oglądanie. Daj znać, jak Ci się podobało — podoba się, zastanawiasz się, czy raczej nie pasuje.',
        'To zajmie chwilę, a każda uwaga pomoże mi lepiej dobierać kolejne propozycje.',
      ],
      property: { title, address: offerAddress || null },
      ctas: portalUrl ? [{ label: 'Oceń w panelu', href: portalUrl }] : [],
    });
    steps.push(emailStep({ to: buyer.email, subject: `Jak wrażenia po oglądaniu? ${title}`, html, replyTo: buyer.agencyUser?.email || undefined }));
  }
  const result = await deliverToClient({
    agencyUserId: params.agencyUserId,
    clientId: buyer.id,
    category: 'reminder',
    source: 'buyer_deal_feedback',
    steps,
  });
  const now = new Date();
  await prisma.offerBuyerDeal.update({
    where: { id: deal.id },
    data: {
      feedbackRequestedAt: now,
      data: withEvent(deal.data, { actor: 'agent', text: result.queued ? 'Pytanie o opinię czeka na Twoją akceptację' : 'Wysłano pytanie o opinię' }, now),
    },
  });
  return { queued: result.queued };
}

/** Sprzedający dostaje wynik oglądania bez danych osobowych kupującego — po podglądzie i akceptacji agenta. */
export async function informSellerAboutDeal(params: { agencyUserId: number; dealId: number; message?: string | null }) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  if (!deal.sellerClientId) throw new Error('Ta oferta nie ma sprzedającego w Twoim CRM.');
  const view = await getDeal(params.agencyUserId, deal.id);
  const seller = await prisma.agencyClient.findFirst({
    where: { id: deal.sellerClientId, agencyUserId: params.agencyUserId },
    select: { id: true, firstName: true, salutation: true, email: true, portalToken: true, linkedUserId: true, agencyUser: { select: { name: true, email: true } } },
  });
  if (!seller || !view) throw new Error('Nie znaleziono sprzedającego.');
  const custom = String(params.message || '').trim().slice(0, 2000);
  const sentiment = view.feedback?.sentiment || null;
  const lead =
    sentiment === 'like'
      ? 'Mam dobre wieści — kupujący, który oglądał Twoją nieruchomość, jest zainteresowany. Porozmawiam z nim o dalszych krokach i od razu dam znać.'
      : sentiment === 'maybe'
        ? 'Kupujący po oglądaniu jeszcze się zastanawia. Zostaję z nim w kontakcie i dam znać, gdy podejmie decyzję.'
        : sentiment === 'dislike'
          ? 'Kupujący po oglądaniu zrezygnował — ta nieruchomość nie odpowiada jego potrzebom. Szukamy dalej, a jego uwagi pomogą lepiej dobierać kolejne pokazy.'
          : 'Oglądanie się odbyło. Czekam na opinię kupującego i przekażę ją, jak tylko ją dostanę.';
  const note = view.feedback?.note ? tidySentence(view.feedback.note) : '';
  const viewedAt = view.presentation?.heldAt || view.presentation?.startsAt || null;
  const { deliverToClient, emailStep } = await import('@/lib/crm/clientOutbox');
  const { buildPortalUrl } = await import('@/lib/agencyClientNotify');
  const { buildClientVoice, withChatLead } = await import('@/lib/crm/clientVoice');
  const { buildClientMessageEmailHtml } = await import('@/lib/crm/clientMessageEmail');
  const voice = buildClientVoice({ clientId: seller.id, firstName: seller.firstName, salutation: seller.salutation, agentName: seller.agencyUser?.name });
  const portalUrl = seller.portalToken ? buildPortalUrl(seller.portalToken) : null;
  const chatText = [lead, note ? `Uwagi kupującego: „${note}”` : '', custom].filter(Boolean).join(' ');
  const steps: Parameters<typeof deliverToClient>[0]['steps'] = [
    {
      kind: 'chat',
      params: {
        clientId: seller.id,
        agencyUserId: params.agencyUserId,
        linkedUserId: seller.linkedUserId,
        from: 'agent',
        content: withChatLead(voice, chatText),
        activityMetadata: { offerId: deal.offerId, kind: 'showing_result' },
      },
    },
  ];
  if (portalUrl) steps.push({ kind: 'push', clientId: seller.id, payload: { title: 'Wynik oglądania', body: chatText.slice(0, 160), tag: `showing-${deal.id}`, url: portalUrl } });
  if (seller.email) {
    const html = await buildClientMessageEmailHtml({
      agencyUserId: params.agencyUserId,
      client: seller,
      eyebrow: 'Wynik oglądania',
      title: sentiment === 'like' ? 'Kupujący jest zainteresowany' : 'Wynik oglądania Twojej nieruchomości',
      paragraphs: [lead, ...(custom ? custom.split(/\n{2,}/) : [])],
      property: { title: view.offer.title, address: view.offer.address || null },
      facts: [
        { label: 'Oglądanie', value: viewedAt ? when(viewedAt) : '' },
        {
          label: 'Ocena kupującego',
          value: sentiment ? SENTIMENT_LABEL[sentiment] : 'Czekamy na opinię',
          tone: sentiment === 'like' ? 'good' : sentiment === 'dislike' ? 'bad' : 'warn',
        },
      ],
      quote: note ? { label: 'Uwagi kupującego', text: note } : null,
      ctas: portalUrl ? [{ label: 'Zobacz w panelu', href: portalUrl }] : [],
    });
    steps.push(emailStep({ to: seller.email, subject: sentiment === 'like' ? 'Kupujący jest zainteresowany Twoją nieruchomością' : 'Wynik oglądania Twojej nieruchomości', html, replyTo: seller.agencyUser?.email || undefined }));
  }
  const result = await deliverToClient({
    agencyUserId: params.agencyUserId,
    clientId: seller.id,
    category: 'visit',
    source: 'buyer_deal_seller_update',
    steps,
  });
  const now = new Date();
  await prisma.offerBuyerDeal.update({
    where: { id: deal.id },
    data: {
      sellerInformedAt: now,
      data: withEvent(deal.data, { actor: 'agent', text: result.queued ? 'Wiadomość do sprzedającego czeka na Twoją akceptację' : 'Przekazano sprzedającemu wynik oglądania' }, now),
    },
  });
  return { queued: result.queued };
}

/* ───────────────────────── przypomnienia dla agenta (cron co godzinę) ───────────────────────── */

const H = 60 * 60 * 1000;

export async function scanBuyerDealReminders(): Promise<{ sent: number }> {
  const deals = await prisma.offerBuyerDeal.findMany({
    where: { status: 'ACTIVE', createdAt: { gte: new Date(Date.now() - 120 * 24 * H) } },
    orderBy: { updatedAt: 'desc' },
    take: 600,
  });
  if (!deals.length) return { sent: 0 };
  const { sendNotification } = await import('@/lib/core/notification.core');
  const { crmAgentPushData } = await import('@/lib/crm/agentPush');
  const views = shapeAll(deals, await buildContext(deals));
  const now = Date.now();
  let sent = 0;
  for (const view of views) {
    const deal = deals.find((row) => row.id === view.id)!;
    const reminders = parseData(deal.data).reminders || {};
    const who = view.buyer.kind === 'client' ? view.buyer.name : view.buyer.agency || view.buyer.name || 'Kupujący';
    const pushTarget = view.buyer.kind === 'client' ? view.buyer.clientId : view.seller?.clientId;
    let key: string | null = null;
    let title = '';
    let body = '';
    const startsAt = view.presentation ? new Date(view.presentation.startsAt).getTime() : NaN;
    if (view.stage === 'scheduled' && startsAt - now > 20 * H && startsAt - now <= 26 * H) {
      key = `pre:${view.presentation!.startsAt}`;
      title = 'Jutro prezentacja';
      body = `${who} · ${view.offer.title} · ${when(view.presentation!.startsAt)}`;
    } else if (view.stage === 'scheduled' && startsAt - now > 0 && startsAt - now <= 2 * H) {
      key = `pre2:${view.presentation!.startsAt}`;
      title = 'Za 2 godziny prezentacja';
      body = `${who} · ${view.offer.title} · ${when(view.presentation!.startsAt)}`;
    } else if (view.stage === 'scheduled' && now - startsAt > 3 * H && now - startsAt < 7 * 24 * H) {
      key = `held:${view.presentation!.startsAt}`;
      title = 'Czy prezentacja się odbyła?';
      body = `${who} · ${view.offer.title} — oznacz ją jako odbytą i zbierz opinię.`;
    } else if (view.stage === 'viewed' && view.presentation?.heldAt) {
      const heldAt = new Date(view.presentation.heldAt).getTime();
      if (now - heldAt > 24 * H && now - heldAt < 10 * 24 * H) {
        key = `feedback:${view.presentation.heldAt}`;
        title = 'Brak opinii po prezentacji';
        body = `${who} · ${view.offer.title} — zapytaj o wrażenia.`;
      }
    }
    if (!key && view.turn.deadline && view.turn.offerId && (view.turn.side === 'buyer' || view.turn.side === 'seller')) {
      // Zegar odpowiedzi na ofertę: po 24 h przypomnienie stronie, po 48 h sygnał dla agenta.
      const deadline = new Date(view.turn.deadline).getTime();
      const partyId = view.turn.side === 'buyer' ? (view.buyer.kind === 'client' ? view.buyer.clientId : null) : view.seller?.clientId ?? null;
      const nudgeKey = `nudge:${view.turn.offerId}`;
      if (partyId && !reminders[nudgeKey] && deadline - now <= 24 * H && deadline > now) {
        const { deliverToClient } = await import('@/lib/crm/clientOutbox');
        const client = await prisma.agencyClient.findUnique({ where: { id: partyId }, select: { portalToken: true } });
        if (client?.portalToken) {
          const { buildPortalUrl } = await import('@/lib/agencyClientNotify');
          await deliverToClient({
            agencyUserId: deal.agencyUserId,
            clientId: partyId,
            category: 'reminder',
            source: 'buyer_deal_nudge',
            approved: true,
            steps: [{ kind: 'push', clientId: partyId, payload: { title: 'Czekamy na Twoją odpowiedź', body: `Oferta do ${when(view.turn.deadline)} — odpowiedz w panelu.`, tag: `deal-${deal.id}`, url: buildPortalUrl(client.portalToken) } }],
          }).catch(() => null);
        }
        await prisma.offerBuyerDeal.update({
          where: { id: deal.id },
          data: { data: { ...parseData(deal.data), reminders: { ...reminders, [nudgeKey]: new Date().toISOString() } } as Prisma.InputJsonValue },
        });
        continue;
      }
      if (deadline <= now) {
        key = `expired:${view.turn.offerId}`;
        title = 'Minął czas na odpowiedź';
        body = `${who} · ${view.offer.title} — ${view.turn.label}. Zadzwoń albo zapisz odpowiedź.`;
      }
    }
    if (!key) {
      // Terminy transakcji: dzień wcześniej przypominamy o rezerwacji, umowie, akcie i kluczach.
      const tx = view.transaction;
      const terms = view.negotiation.terms || {};
      const upcoming: Array<[string, string | null | undefined, string]> = [
        ['reservation', view.negotiation.reservation?.until, 'Jutro kończy się rezerwacja'],
        ['preliminary', tx.preliminary?.done ? null : tx.preliminary?.date || terms.preliminaryAt, 'Jutro umowa przedwstępna'],
        ['deed', tx.deed?.done ? null : tx.deed?.date || terms.deedAt, 'Jutro akt notarialny'],
        ['handover', tx.handover?.done ? null : tx.handover?.date || terms.handoverAt, 'Jutro przekazanie kluczy'],
      ];
      for (const [kind, date, label] of upcoming) {
        const at = date ? new Date(date).getTime() : NaN;
        if (Number.isFinite(at) && at - now > 0 && at - now <= 26 * H && !reminders[`${kind}:${date}`]) {
          key = `${kind}:${date}`;
          title = label;
          body = `${who} · ${view.offer.title} · ${when(date!)}`;
          break;
        }
      }
    }
    if (!key || reminders[key] || !pushTarget) continue;
    await sendNotification({
      userId: deal.agencyUserId,
      type: 'CRM_EVENT',
      title,
      body,
      data: crmAgentPushData(pushTarget, { notificationType: 'crm_buyer_deal', dealId: deal.id, offerId: deal.offerId }),
      idempotencyKey: `buyer-deal-${deal.id}-${key}`.slice(0, 190),
    }).catch(() => {});
    await prisma.offerBuyerDeal.update({
      where: { id: deal.id },
      data: { data: { ...parseData(deal.data), reminders: { ...reminders, [key]: new Date().toISOString() } } as Prisma.InputJsonValue },
    });
    sent += 1;
  }
  return { sent };
}
