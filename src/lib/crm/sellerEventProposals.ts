import { prisma } from '@/lib/prisma';
import { createOpenHouseEvent } from '@/lib/openHouse';
import { createAuctionEvent } from '@/lib/auction';
import { agentCanPublishOfferEvents } from '@/lib/crm/agencyTeammates';
import {
  createClientDecisionRequest,
  upsertSellerNextStep,
  shapeClientDecision,
  type ClientDecisionPayload,
} from '@/lib/crm/sellerMarketing';
import {
  computeSellerEventStage,
  parseSellerEventProposal,
  type SellerEventKind,
  type SellerEventProposalPayload,
  type SellerEventStage,
} from '@/lib/crm/sellerEventStage';

function formatWhen(iso: string | null | undefined) {
  if (!iso) return '';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '';
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

async function resolveLinkedOfferForAgent(clientId: number, agencyUserId: number) {
  const client = await prisma.agencyClient.findFirst({
    where: {
      id: clientId,
      agencyUserId,
      type: 'SELLER',
      status: 'ACTIVE',
    },
    select: {
      id: true,
      linkedOfferId: true,
      linkedOffer: {
        select: {
          id: true,
          userId: true,
          status: true,
          title: true,
        },
      },
    },
  });
  if (!client?.linkedOfferId || !client.linkedOffer) {
    return { ok: false as const, error: 'Najpierw powiąż aktywne ogłoszenie z klientem.' };
  }
  if (String(client.linkedOffer.status).toUpperCase() !== 'ACTIVE') {
    return { ok: false as const, error: 'Ogłoszenie musi być aktywne, żeby zaplanować wydarzenie.' };
  }
  // Typical acquisition: offer owned by agent. Also allow if offer is this client's linkedOffer.
  if (client.linkedOffer.userId !== agencyUserId) {
    const teammate = await agentCanPublishOfferEvents(agencyUserId, client.linkedOffer.userId);
    if (!teammate) {
      return {
        ok: false as const,
        error: 'Możesz zaproponować wydarzenie tylko dla ogłoszenia na Twoim koncie albo w Twoim biurze.',
      };
    }
  }
  return { ok: true as const, client, offer: client.linkedOffer };
}

export async function proposeOpenHouseToSeller(params: {
  clientId: number;
  agencyUserId: number;
  startsAt: string;
  endsAt: string;
  capacity?: number;
  visitMode?: 'FLEX' | 'SLOT_30' | 'SLOT_60';
  clientMessage?: string | null;
  title?: string | null;
}) {
  const owned = await resolveLinkedOfferForAgent(params.clientId, params.agencyUserId);
  if (!owned.ok) return owned;

  const startsAt = new Date(params.startsAt);
  const endsAt = new Date(params.endsAt);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
    return { ok: false as const, error: 'Podaj poprawny termin dnia otwartego.' };
  }
  if (startsAt.getTime() < Date.now() - 60_000) {
    return { ok: false as const, error: 'Termin musi być w przyszłości.' };
  }

  const payload: SellerEventProposalPayload = {
    source: 'crm_plan',
    kind: 'open_house',
    offerId: owned.offer.id,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    slots: [
      {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        capacity: params.capacity && params.capacity > 0 ? params.capacity : 8,
      },
    ],
    visitMode: params.visitMode || 'FLEX',
    clientMessage: params.clientMessage?.trim() || null,
  };

  const when = formatWhen(startsAt.toISOString());
  const title = (params.title || `Dzień otwarty — ${when}`).slice(0, 255);
  const clientMessage =
    (params.clientMessage?.trim() ||
      `Proponuję dzień otwartych drzwi ${when}. Potwierdź termin, żebym mógł opublikować wydarzenie na ogłoszeniu.`) +
    `\n\nOferta: ${owned.offer.title}`;

  const decision = await createClientDecisionRequest({
    clientId: params.clientId,
    agencyUserId: params.agencyUserId,
    kind: 'open_house',
    title,
    clientMessage,
    dueAt: startsAt,
    payload,
  });
  if (!decision.ok) return decision;

  await upsertSellerNextStep({
    clientId: params.clientId,
    agencyUserId: params.agencyUserId,
    currentStep: 'Dzień otwarty — czekamy na Twoją zgodę',
    nextAction: `Potwierdź termin: ${when}`,
    clientMessage: params.clientMessage?.trim() || clientMessage,
    dueAt: startsAt,
    visibleToClient: true,
  });

  await prisma.agencyClientActivity.create({
    data: {
      clientId: params.clientId,
      agencyUserId: params.agencyUserId,
      offerId: owned.offer.id,
      kind: 'OPEN_HOUSE_PROPOSAL',
      title,
      body: clientMessage,
      metadata: {
        visibleToClient: true,
        decisionId: decision.decision.id,
        ...payload,
      },
    },
  });

  return { ok: true as const, decision: decision.decision };
}

export async function proposeAuctionToSeller(params: {
  clientId: number;
  agencyUserId: number;
  startsAt: string;
  endsAt: string;
  startPrice: number;
  reservePrice?: number | null;
  minIncrement?: number | null;
  clientMessage?: string | null;
  title?: string | null;
}) {
  const owned = await resolveLinkedOfferForAgent(params.clientId, params.agencyUserId);
  if (!owned.ok) return owned;

  const startsAt = new Date(params.startsAt);
  const endsAt = new Date(params.endsAt);
  const startPrice = Number(params.startPrice);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
    return { ok: false as const, error: 'Podaj poprawny okres licytacji.' };
  }
  if (startsAt.getTime() < Date.now() - 60_000) {
    return { ok: false as const, error: 'Start licytacji musi być w przyszłości.' };
  }
  if (!Number.isFinite(startPrice) || startPrice <= 0) {
    return { ok: false as const, error: 'Podaj cenę startową.' };
  }
  const reservePrice =
    params.reservePrice != null && Number(params.reservePrice) > 0 ? Number(params.reservePrice) : null;
  if (reservePrice != null && reservePrice < startPrice) {
    return { ok: false as const, error: 'Cena rezerwowa nie może być niższa od startowej.' };
  }

  const payload: SellerEventProposalPayload = {
    source: 'crm_plan',
    kind: 'auction',
    offerId: owned.offer.id,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    startPrice,
    reservePrice,
    minIncrement:
      params.minIncrement != null && Number(params.minIncrement) > 0
        ? Number(params.minIncrement)
        : null,
    clientMessage: params.clientMessage?.trim() || null,
  };

  const when = `${formatWhen(startsAt.toISOString())} → ${formatWhen(endsAt.toISOString())}`;
  const title = (params.title || `Licytacja — od ${formatMoney(startPrice)}`).slice(0, 255);
  const clientMessage =
    (params.clientMessage?.trim() ||
      `Proponuję licytację na Twoim ogłoszeniu.\nStart: ${formatWhen(startsAt.toISOString())}\nKoniec: ${formatWhen(endsAt.toISOString())}\nCena startowa: ${formatMoney(startPrice)}${
        reservePrice ? `\nCena rezerwowa: ${formatMoney(reservePrice)}` : ''
      }.\n\nPotwierdź warunki, żebym mógł opublikować licytację.`) +
    `\n\nOferta: ${owned.offer.title}`;

  const decision = await createClientDecisionRequest({
    clientId: params.clientId,
    agencyUserId: params.agencyUserId,
    kind: 'auction',
    title,
    clientMessage,
    dueAt: startsAt,
    payload,
  });
  if (!decision.ok) return decision;

  await upsertSellerNextStep({
    clientId: params.clientId,
    agencyUserId: params.agencyUserId,
    currentStep: 'Licytacja — czekamy na Twoją zgodę',
    nextAction: `Potwierdź warunki: od ${formatMoney(startPrice)}, ${when}`,
    clientMessage: params.clientMessage?.trim() || clientMessage,
    dueAt: startsAt,
    visibleToClient: true,
  });

  await prisma.agencyClientActivity.create({
    data: {
      clientId: params.clientId,
      agencyUserId: params.agencyUserId,
      offerId: owned.offer.id,
      kind: 'AUCTION_PROPOSAL',
      title,
      body: clientMessage,
      metadata: {
        visibleToClient: true,
        decisionId: decision.decision.id,
        ...payload,
      },
    },
  });

  return { ok: true as const, decision: decision.decision };
}

export async function fulfillSellerEventProposal(params: {
  clientId: number;
  decision: {
    id: number;
    agencyUserId: number;
    kind: string;
    title: string;
    payload: unknown;
  };
}) {
  const proposal = parseSellerEventProposal(params.decision.payload);
  if (!proposal) {
    return { ok: false as const, error: 'Brak danych wydarzenia do publikacji. Wyślij propozycję ponownie.' };
  }

  const agencyUserId = params.decision.agencyUserId;
  const offer = await prisma.offer.findFirst({
    where: { id: proposal.offerId, status: 'ACTIVE' },
    select: { id: true, title: true, userId: true },
  });
  if (!offer) {
    return { ok: false as const, error: 'Nie znaleziono aktywnego ogłoszenia do publikacji wydarzenia.' };
  }
  const canPublish = await agentCanPublishOfferEvents(agencyUserId, offer.userId);
  if (!canPublish) {
    return { ok: false as const, error: 'Nie znaleziono aktywnego ogłoszenia do publikacji wydarzenia.' };
  }
  const hostUserId = offer.userId;

  let eventId: number | null = null;
  try {
    if (proposal.kind === 'open_house') {
      const slots = proposal.slots?.length
        ? proposal.slots
        : proposal.startsAt && proposal.endsAt
          ? [{ startsAt: proposal.startsAt, endsAt: proposal.endsAt, capacity: 8 }]
          : [];
      if (!slots.length) return { ok: false as const, error: 'Brak terminu dnia otwartego.' };
      const event = await createOpenHouseEvent(hostUserId, {
        offerId: offer.id,
        title: params.decision.title,
        description: proposal.clientMessage || null,
        visitMode: proposal.visitMode || 'FLEX',
        slots,
        publish: true,
      });
      eventId = Number(event.id);
    } else {
      if (!proposal.startsAt || !proposal.endsAt || !proposal.startPrice) {
        return { ok: false as const, error: 'Brak warunków licytacji.' };
      }
      const event = await createAuctionEvent(hostUserId, {
        offerId: offer.id,
        title: params.decision.title,
        description: proposal.clientMessage || null,
        startPrice: proposal.startPrice,
        reservePrice: proposal.reservePrice,
        minIncrement: proposal.minIncrement,
        startsAt: proposal.startsAt,
        endsAt: proposal.endsAt,
        publish: true,
      });
      eventId = Number(event.id);
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    const map: Record<string, string> = {
      OFFER_NOT_FOUND: 'Ogłoszenie niedostępne dla agenta.',
      ALREADY_PUBLISHED: 'Dzień otwarty jest już opublikowany na tym ogłoszeniu.',
      ALREADY_ACTIVE: 'Licytacja jest już aktywna na tym ogłoszeniu.',
      SLOTS_REQUIRED: 'Brak slotów dnia otwartego.',
      INVALID_START_PRICE: 'Nieprawidłowa cena startowa.',
      RESERVE_BELOW_START: 'Cena rezerwowa poniżej startowej.',
    };
    return { ok: false as const, error: map[code] || `Nie udało się opublikować wydarzenia (${code}).` };
  }

  const nextPayload = { ...proposal, eventId, source: 'crm_plan' as const };
  await prisma.clientDecisionRequest.update({
    where: { id: params.decision.id },
    data: { payload: nextPayload },
  });

  const when =
    proposal.kind === 'auction'
      ? `${formatWhen(proposal.startsAt)} → ${formatWhen(proposal.endsAt)}`
      : formatWhen(proposal.startsAt || proposal.slots?.[0]?.startsAt);

  await upsertSellerNextStep({
    clientId: params.clientId,
    agencyUserId,
    currentStep: proposal.kind === 'auction' ? 'Licytacja potwierdzona' : 'Dzień otwarty potwierdzony',
    nextAction:
      proposal.kind === 'auction'
        ? `Licytacja zaplanowana ${when}${proposal.startPrice ? ` · od ${formatMoney(proposal.startPrice)}` : ''}`
        : `Dzień otwarty ${when}`,
    clientMessage:
      proposal.kind === 'auction'
        ? 'Warunki licytacji zatwierdzone — wydarzenie jest już na ogłoszeniu.'
        : 'Termin dnia otwartego zatwierdzony — wydarzenie jest już na ogłoszeniu.',
    dueAt: proposal.startsAt ? new Date(proposal.startsAt) : null,
    visibleToClient: true,
  });

  await prisma.agencyClientActivity.create({
    data: {
      clientId: params.clientId,
      agencyUserId,
      offerId: offer.id,
      kind: proposal.kind === 'auction' ? 'AUCTION_CONFIRMED' : 'OPEN_HOUSE_CONFIRMED',
      title: params.decision.title,
      body:
        proposal.kind === 'auction'
          ? `Klient zatwierdził licytację. Wydarzenie #${eventId} opublikowane.`
          : `Klient zatwierdził dzień otwarty. Wydarzenie #${eventId} opublikowane.`,
      metadata: {
        ...nextPayload,
        visibleToClient: true,
        decisionId: params.decision.id,
        eventId,
        source: 'crm_plan',
      },
    },
  });

  return { ok: true as const, eventId, kind: proposal.kind };
}

export async function loadSellerEventsBundle(clientId: number): Promise<{
  openHouse: {
    proposal: ClientDecisionPayload | null;
    event: {
      id: number;
      status: string;
      startsAt: string | null;
      endsAt: string | null;
      title: string | null;
    } | null;
  };
  auction: {
    proposal: ClientDecisionPayload | null;
    event: {
      id: number;
      status: string;
      startsAt: string | null;
      endsAt: string | null;
      startPrice: number;
      title: string | null;
    } | null;
  };
  stage: SellerEventStage | null;
}> {
  const client = await prisma.agencyClient.findUnique({
    where: { id: clientId },
    select: { linkedOfferId: true },
  });
  const offerId = client?.linkedOfferId || null;

  const [pending, rejected, openHouse, auction] = await Promise.all([
    prisma.clientDecisionRequest.findMany({
      where: {
        clientId,
        status: 'PENDING',
        kind: { in: ['open_house', 'auction'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
    prisma.clientDecisionRequest.findFirst({
      where: {
        clientId,
        status: 'REJECTED',
        kind: { in: ['open_house', 'auction'] },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    offerId
      ? prisma.openHouseEvent.findFirst({
          where: { offerId, status: { in: ['PUBLISHED', 'COMPLETED', 'CANCELLED'] } },
          orderBy: { updatedAt: 'desc' },
          include: { slots: { orderBy: { startsAt: 'asc' }, take: 1 } },
        })
      : Promise.resolve(null),
    offerId
      ? prisma.auctionEvent.findFirst({
          where: {
            offerId,
            status: { in: ['SCHEDULED', 'LIVE', 'ENDED', 'SETTLED', 'CANCELLED'] },
          },
          orderBy: { updatedAt: 'desc' },
        })
      : Promise.resolve(null),
  ]);

  const ohProposal = pending.find((row) => row.kind === 'open_house') || null;
  const auctionProposal = pending.find((row) => row.kind === 'auction') || null;
  const lastOhSlot = openHouse?.slots?.[0] || null;

  const stage = computeSellerEventStage({
    pendingKind: (ohProposal?.kind || auctionProposal?.kind || null) as SellerEventKind | null,
    rejectedKind: rejected ? (rejected.kind as SellerEventKind) : null,
    openHouseStatus: openHouse?.status || null,
    openHouseStartsAt: lastOhSlot?.startsAt?.toISOString() || null,
    openHouseEndsAt: lastOhSlot?.endsAt?.toISOString() || null,
    auctionStatus: auction?.status || null,
    auctionStartsAt: auction?.startsAt?.toISOString() || null,
    auctionEndsAt: auction?.endsAt?.toISOString() || auction?.extendedEndsAt?.toISOString() || null,
  });

  return {
    openHouse: {
      proposal: ohProposal ? shapeClientDecision(ohProposal as never) : null,
      event: openHouse
        ? {
            id: openHouse.id,
            status: openHouse.status,
            startsAt: lastOhSlot?.startsAt?.toISOString() || null,
            endsAt: lastOhSlot?.endsAt?.toISOString() || null,
            title: openHouse.title,
          }
        : null,
    },
    auction: {
      proposal: auctionProposal ? shapeClientDecision(auctionProposal as never) : null,
      event: auction
        ? {
            id: auction.id,
            status: auction.status,
            startsAt: auction.startsAt.toISOString(),
            endsAt: (auction.extendedEndsAt || auction.endsAt).toISOString(),
            startPrice: auction.startPrice,
            title: auction.title,
          }
        : null,
    },
    stage,
  };
}
