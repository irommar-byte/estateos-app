import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { JOURNEY_ACTIVITY, resolvePresentation, type ActivityLike, type ScheduleSlot } from '@/lib/crm/clientJourney';
import { parseClientOfferFeedback } from '@/lib/crm/clientPortalFeedback';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';

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
export type DealStage = 'interested' | 'scheduling' | 'scheduled' | 'viewed' | 'feedback' | 'lost';
export type DealSentiment = 'like' | 'maybe' | 'dislike';
export type DealActor = 'agent' | 'buyer' | 'seller' | 'other_agent';

type DealEvent = { at: string; actor: DealActor; text: string };
type DealData = {
  events?: DealEvent[];
  reminders?: Record<string, string>;
  searchOther?: { wanted: boolean; note: string | null; at: string } | null;
};

export type DealView = {
  id: number;
  offerId: number;
  status: DealStatus;
  source: string;
  sourceLabel: string;
  offer: { id: number; title: string; address: string; price: number | null; imageUrl: string | null };
  seller: { clientId: number; name: string } | null;
  buyer:
    | { kind: 'client'; clientId: number; name: string; phone: string | null; email: string | null }
    | { kind: 'external'; agency: string | null; name: string | null; phone: string | null; email: string | null };
  stage: DealStage;
  phases: Array<{ id: 'presentation' | 'feedback' | 'negotiation' | 'transaction'; label: string; done: boolean; current: boolean }>;
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
  nextAction: string;
  timeline: DealEvent[];
  updatedAt: string;
};

const SOURCE_LABELS: Record<string, string> = {
  radar: 'Wysłana z radaru',
  presentation: 'Umówiona prezentacja',
  inquiry: 'Zapytanie z portalu',
  listing_request: 'Prośba innej agencji',
  guest_agency: 'Pokazuje inna agencja',
  manual: 'Dodany ręcznie',
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

function parseData(raw: unknown): DealData {
  const meta = asMeta(raw);
  return {
    events: Array.isArray(meta.events) ? (meta.events as DealEvent[]) : [],
    reminders: asMeta(meta.reminders) as Record<string, string>,
    searchOther: (meta.searchOther as DealData['searchOther']) ?? null,
  };
}

function withEvent(raw: unknown, event: Omit<DealEvent, 'at'>, at = new Date()): Prisma.InputJsonValue {
  const data = parseData(raw);
  const events = [...(data.events || []), { ...event, at: at.toISOString() }].slice(-120);
  return { ...data, events } as unknown as Prisma.InputJsonValue;
}

const WHEN = new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function when(value: string | Date): string {
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

  const matches = await prisma.agencyClientMatch.findMany({
    where: {
      offerId,
      OR: [{ notifiedAt: { not: null } }, { sharedAt: { not: null } }, { clientFavorite: true }],
      client: { agencyUserId, type: 'BUYER', status: 'ACTIVE' },
    },
    select: { clientId: true },
  });
  for (const match of matches) rows.push({ ...base, buyerClientId: match.clientId, source: 'radar' });

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
  if (seller) {
    await prisma.offerBuyerDeal.updateMany({
      where: { offerId, agencyUserId, sellerClientId: null },
      data: { sellerClientId: seller.id },
    });
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

function buildTimeline(rows: ActivityRow[], deal: DealRow, matchFeedback: { text: string; at: string } | null): DealEvent[] {
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
  events.push(...(parseData(deal.data).events || []));
  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

type Context = {
  activities: ActivityRow[];
  matches: Array<{ clientId: number; offerId: number; clientFeedback: string | null; clientFeedbackAt: Date | null }>;
  clients: Map<number, { firstName: string; lastName: string; phone: string | null; email: string | null }>;
  offers: Map<number, { id: number; title: string; street: string | null; district: string; city: string; price: number; images: string | null }>;
  agencies: Map<number, string>;
};

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
  if (deal.buyerClientId) {
    const match = ctx.matches.find((row) => row.clientId === deal.buyerClientId && row.offerId === deal.offerId);
    const parsed = parseClientOfferFeedback(match?.clientFeedback);
    if (parsed.sentiment) {
      const at = iso(match?.clientFeedbackAt) || null;
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
  const stage: DealStage =
    status === 'LOST'
      ? 'lost'
      : feedback
        ? 'feedback'
        : heldAt
          ? 'viewed'
          : presentation?.status === 'confirmed'
            ? 'scheduled'
            : presentation
              ? 'scheduling'
              : 'interested';

  const presentationDone = Boolean(heldAt);
  const feedbackDone = Boolean(feedback);
  const phaseDone = [presentationDone, feedbackDone, false, false];
  const firstOpen = phaseDone.findIndex((done) => !done);
  const labels = ['Prezentacja', 'Opinia', 'Negocjacje', 'Transakcja'] as const;
  const ids = ['presentation', 'feedback', 'negotiation', 'transaction'] as const;
  const phases = ids.map((id, index) => ({
    id,
    label: labels[index],
    done: phaseDone[index],
    current: status !== 'LOST' && index === firstOpen,
  }));

  const data = parseData(deal.data);
  const nextAction = (() => {
    if (status === 'LOST') return data.searchOther?.wanted ? 'Nie pasuje — szukamy dla niego czegoś innego' : 'Zakończone — kupujący zrezygnował';
    if (status === 'PAUSED') return 'Wstrzymane';
    if (stage === 'interested') return 'Umów prezentację';
    if (stage === 'scheduling') {
      return presentation?.proposedBy === 'client' ? 'Kupujący proponuje termin — potwierdź' : 'Czekamy, aż kupujący wybierze termin';
    }
    if (stage === 'scheduled') return presentation?.past ? 'Oznacz prezentację jako odbytą' : `Prezentacja ${when(presentation!.startsAt)}`;
    if (stage === 'viewed') return deal.feedbackRequestedAt ? 'Czekamy na opinię kupującego' : 'Zbierz opinię kupującego';
    if (feedback?.sentiment === 'dislike') return 'Nie pasuje — zapytaj, czy szukamy czegoś innego';
    if (!deal.sellerInformedAt && deal.sellerClientId) return 'Przekaż opinię sprzedającemu';
    if (feedback?.sentiment === 'maybe') return 'Zastanawia się — dopytaj za kilka dni';
    return 'Porozmawiaj o cenie i warunkach';
  })();

  const offer = ctx.offers.get(deal.offerId);
  const sellerRow = deal.sellerClientId ? ctx.clients.get(deal.sellerClientId) : null;
  const buyerRow = deal.buyerClientId ? ctx.clients.get(deal.buyerClientId) : null;
  const otherAgencyClientId = deal.externalKey?.startsWith('agent:') ? Number(deal.externalKey.slice(6)) : null;
  const otherAgentUserId = otherAgencyClientId
    ? ctx.activities.find((row) => row.clientId === otherAgencyClientId)?.agencyUserId
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
    seller: deal.sellerClientId && sellerRow ? { clientId: deal.sellerClientId, name: `${sellerRow.firstName} ${sellerRow.lastName}`.trim() } : null,
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
    phases,
    presentation,
    attendance,
    feedback,
    feedbackRequestedAt: iso(deal.feedbackRequestedAt),
    sellerInformedAt: iso(deal.sellerInformedAt),
    searchOther: data.searchOther ?? null,
    nextAction,
    timeline: buildTimeline(rows, deal, matchFeedback),
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
          select: { clientId: true, offerId: true, clientFeedback: true, clientFeedbackAt: true },
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
  };
}

function shapeAll(deals: DealRow[], ctx: Context): DealView[] {
  return deals.map((deal) => shapeDeal(deal, ctx));
}

const STAGE_ORDER: Record<DealStage, number> = { feedback: 0, viewed: 1, scheduled: 2, scheduling: 3, interested: 4, lost: 5 };

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

async function ownedDeal(agencyUserId: number, dealId: number) {
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
export async function scheduleExternalViewing(params: { agencyUserId: number; dealId: number; startsAt: Date }) {
  const deal = await ownedDeal(params.agencyUserId, params.dealId);
  if (deal.buyerClientId) throw new Error('Termin dla kupującego z CRM ustal w jego karcie.');
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
  const offer = await prisma.offer.findUnique({ where: { id: deal.offerId }, select: { title: true } });
  const { deliverToClient, emailStep } = await import('@/lib/crm/clientOutbox');
  const { buildPortalUrl } = await import('@/lib/agencyClientNotify');
  const { buildClientVoice } = await import('@/lib/crm/clientVoice');
  const voice = buildClientVoice({ clientId: buyer.id, firstName: buyer.firstName, salutation: buyer.salutation, agentName: buyer.agencyUser?.name });
  const title = offer?.title || `oferta #${deal.offerId}`;
  const portalUrl = buyer.portalToken ? buildPortalUrl(buyer.portalToken) : null;
  const question = `jak wrażenia po oglądaniu „${title}”? Podoba się, zastanawia, czy raczej nie pasuje? Jedno kliknięcie w panelu wystarczy — każda uwaga pomoże mi w dalszych poszukiwaniach.`;
  const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string);
  const steps: Parameters<typeof deliverToClient>[0]['steps'] = [
    {
      kind: 'chat',
      params: {
        clientId: buyer.id,
        agencyUserId: params.agencyUserId,
        linkedUserId: buyer.linkedUserId,
        from: 'agent',
        content: `${voice.chatLead}${question}`,
        activityMetadata: { offerId: deal.offerId, kind: 'feedback_request' },
      },
    },
  ];
  if (portalUrl) steps.push({ kind: 'push', clientId: buyer.id, payload: { title: 'Jak wrażenia po oglądaniu?', body: title, tag: `feedback-${deal.id}`, url: portalUrl } });
  if (buyer.email) {
    const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:540px;margin:0 auto;padding:24px;color:#15171A">
      <p style="margin:0 0 14px;font-size:15px">${esc(voice.greeting)}</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6">${esc(question)}</p>
      ${portalUrl ? `<p><a href="${portalUrl}" style="display:inline-block;background:#0E4D3F;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">Oceń w panelu</a></p>` : ''}
      <p style="margin:22px 0 0;font-size:13px;color:#5B574F">Pozdrawiam,<br/>${esc(buyer.agencyUser?.name || 'Twój agent')}</p></div>`;
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
  const viewedLabel = view.presentation?.heldAt ? `oglądanie ${when(view.presentation.heldAt)}` : 'oglądanie';
  const text =
    custom ||
    [
      `po ${viewedLabel}: ${view.feedback ? SENTIMENT_LABEL[view.feedback.sentiment].toLowerCase() : 'kupujący jeszcze się zastanawia'}.`,
      view.feedback?.note ? `Uwagi: ${view.feedback.note}.` : null,
    ]
      .filter(Boolean)
      .join(' ');
  const { deliverToClient, emailStep } = await import('@/lib/crm/clientOutbox');
  const { buildPortalUrl } = await import('@/lib/agencyClientNotify');
  const { buildClientVoice } = await import('@/lib/crm/clientVoice');
  const voice = buildClientVoice({ clientId: seller.id, firstName: seller.firstName, salutation: seller.salutation, agentName: seller.agencyUser?.name });
  const portalUrl = seller.portalToken ? buildPortalUrl(seller.portalToken) : null;
  const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string);
  const steps: Parameters<typeof deliverToClient>[0]['steps'] = [
    {
      kind: 'chat',
      params: {
        clientId: seller.id,
        agencyUserId: params.agencyUserId,
        linkedUserId: seller.linkedUserId,
        from: 'agent',
        content: `${voice.chatLead}${text}`,
        activityMetadata: { offerId: deal.offerId, kind: 'showing_result' },
      },
    },
  ];
  if (portalUrl) steps.push({ kind: 'push', clientId: seller.id, payload: { title: 'Wynik oglądania', body: text.slice(0, 160), tag: `showing-${deal.id}`, url: portalUrl } });
  if (seller.email) {
    const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:540px;margin:0 auto;padding:24px;color:#15171A">
      <p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#7A5F33">Wynik oglądania</p>
      <p style="margin:0 0 14px;font-size:15px">${esc(voice.greeting)}</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6">${esc(text)}</p>
      ${portalUrl ? `<p><a href="${portalUrl}" style="display:inline-block;background:#0E4D3F;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">Otwórz panel</a></p>` : ''}
      <p style="margin:22px 0 0;font-size:13px;color:#5B574F">Pozdrawiam,<br/>${esc(seller.agencyUser?.name || 'Twój agent')}</p></div>`;
    steps.push(emailStep({ to: seller.email, subject: 'Wynik oglądania Twojej nieruchomości', html, replyTo: seller.agencyUser?.email || undefined }));
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
