import { prisma } from '@/lib/prisma';
import type { AuctionEventRecord, AuctionStatus } from '@/lib/auctionTypes';
import {
  notifyAuctionBidPlaced,
  notifyAuctionEnded,
  notifyAuctionOutbid,
  notifyAuctionStartingSoon,
} from '@/lib/auctionNotifications';

const OFFER_SELECT = {
  id: true,
  title: true,
  city: true,
  district: true,
  street: true,
  price: true,
  priceCurrency: true,
  area: true,
  rooms: true,
  propertyType: true,
  transactionType: true,
  images: true,
  status: true,
  userId: true,
  lat: true,
  lng: true,
} as const;

const ANTI_SNIPE_WINDOW_MS = 90_000;
const ANTI_SNIPE_EXTEND_MS = 120_000;
const MIN_AUCTION_DURATION_MS = 60 * 60 * 1000;
const MAX_AUCTION_DURATION_MS = 14 * 24 * 60 * 60 * 1000;
const RECENT_BIDS_LIMIT = 12;

let schemaEnsured = false;

export async function ensureAuctionSchema() {
  if (schemaEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`AuctionEvent\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`offerId\` INT NOT NULL,
        \`hostUserId\` INT NOT NULL,
        \`title\` VARCHAR(255) NULL,
        \`description\` TEXT NULL,
        \`currency\` VARCHAR(8) NOT NULL DEFAULT 'PLN',
        \`startPrice\` DOUBLE NOT NULL,
        \`reservePrice\` DOUBLE NULL,
        \`minIncrement\` DOUBLE NULL,
        \`currentPrice\` DOUBLE NOT NULL DEFAULT 0,
        \`currentBidderUserId\` INT NULL,
        \`bidCount\` INT NOT NULL DEFAULT 0,
        \`startsAt\` DATETIME(3) NOT NULL,
        \`endsAt\` DATETIME(3) NOT NULL,
        \`extendedEndsAt\` DATETIME(3) NULL,
        \`status\` ENUM('DRAFT','SCHEDULED','LIVE','ENDED','CANCELLED','SETTLED') NOT NULL DEFAULT 'DRAFT',
        \`winnerUserId\` INT NULL,
        \`publishedAt\` DATETIME(3) NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        INDEX \`AuctionEvent_offerId_idx\` (\`offerId\`),
        INDEX \`AuctionEvent_hostUserId_idx\` (\`hostUserId\`),
        INDEX \`AuctionEvent_status_startsAt_idx\` (\`status\`, \`startsAt\`),
        INDEX \`AuctionEvent_status_endsAt_idx\` (\`status\`, \`endsAt\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`AuctionBidEntry\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`eventId\` INT NOT NULL,
        \`userId\` INT NOT NULL,
        \`amount\` DOUBLE NOT NULL,
        \`currency\` VARCHAR(8) NOT NULL DEFAULT 'PLN',
        \`status\` ENUM('VALID','OUTBID','WINNING') NOT NULL DEFAULT 'VALID',
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        INDEX \`AuctionBidEntry_eventId_createdAt_idx\` (\`eventId\`, \`createdAt\`),
        INDEX \`AuctionBidEntry_userId_idx\` (\`userId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    schemaEnsured = true;
  } catch {
    // Tables may already exist with FK constraints — Prisma handles normal path.
    schemaEnsured = true;
  }
}

function parseImages(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function computeMinIncrement(currentPrice: number, hostMinIncrement: number | null | undefined): number {
  if (hostMinIncrement != null && hostMinIncrement > 0) return hostMinIncrement;
  const base = Math.max(currentPrice, 1000);
  return Math.max(100, Math.round((base * 0.01) / 100) * 100);
}

export function getEffectiveEndsAt(event: { endsAt: Date; extendedEndsAt: Date | null }) {
  return event.extendedEndsAt ?? event.endsAt;
}

function maskBidderLabel(userId: number, name: string | null, email: string, isHost: boolean) {
  if (isHost) return name || email.split('@')[0] || `Użytkownik ${userId}`;
  const base = name || email.split('@')[0] || 'U';
  if (base.length <= 2) return `${base[0]}***`;
  return `${base.slice(0, 2)}***`;
}

function reserveMet(reservePrice: number | null, currentPrice: number) {
  if (reservePrice == null || reservePrice <= 0) return true;
  return currentPrice >= reservePrice;
}

const eventInclude = {
  offer: { select: OFFER_SELECT },
  host: { select: { id: true, name: true, email: true, phone: true } },
  bids: {
    orderBy: { createdAt: 'desc' as const },
    take: RECENT_BIDS_LIMIT,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  },
};

type RawAuctionEvent = {
  id: number;
  offerId: number;
  hostUserId: number;
  title: string | null;
  description: string | null;
  currency: string;
  startPrice: number;
  reservePrice: number | null;
  minIncrement: number | null;
  currentPrice: number;
  currentBidderUserId: number | null;
  bidCount: number;
  startsAt: Date;
  endsAt: Date;
  extendedEndsAt: Date | null;
  status: string;
  winnerUserId: number | null;
  publishedAt: Date | null;
  offer: {
    id: number;
    title: string;
    city: string;
    district: string;
    street: string | null;
    price: number;
    priceCurrency: string;
    area: number;
    rooms: number | null;
    images: string | null;
  };
  bids: Array<{
    id: number;
    userId: number;
    amount: number;
    currency: string;
    status: string;
    createdAt: Date;
    user: { id: number; name: string | null; email: string };
  }>;
};

export function serializeAuctionEvent(
  event: RawAuctionEvent,
  viewerUserId?: number | null
): AuctionEventRecord {
  const isHost = viewerUserId != null && viewerUserId === event.hostUserId;
  const effectiveEnd = getEffectiveEndsAt(event);
  const now = Date.now();
  const displayPrice = event.currentPrice > 0 ? event.currentPrice : event.startPrice;
  const increment = computeMinIncrement(displayPrice, event.minIncrement);
  const nextMinBid = event.bidCount > 0 ? displayPrice + increment : event.startPrice;
  const images = parseImages(event.offer.images);
  const met = reserveMet(event.reservePrice, event.currentPrice);

  return {
    id: event.id,
    offerId: event.offerId,
    hostUserId: event.hostUserId,
    title: event.title || event.offer.title,
    description: event.description,
    currency: event.currency,
    startPrice: event.startPrice,
    reservePrice: isHost ? event.reservePrice : null,
    reserveMet: isHost || event.status === 'ENDED' || event.status === 'SETTLED' ? met : null,
    minIncrement: increment,
    currentPrice: displayPrice,
    nextMinBid,
    bidCount: event.bidCount,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    effectiveEndsAt: effectiveEnd.toISOString(),
    status: event.status as AuctionStatus,
    winnerUserId: event.winnerUserId,
    publishedAt: event.publishedAt?.toISOString() ?? null,
    isHost,
    isLeading: viewerUserId != null && event.currentBidderUserId === viewerUserId,
    timeUntilStartMs: Math.max(0, event.startsAt.getTime() - now),
    timeRemainingMs: Math.max(0, effectiveEnd.getTime() - now),
    host: {
      id: event.hostUserId,
      name: (event as RawAuctionEvent & { host?: { name?: string | null } }).host?.name ?? null,
    },
    offer: {
      id: event.offer.id,
      title: event.offer.title,
      city: event.offer.city,
      district: event.offer.district,
      street: event.offer.street,
      price: event.offer.price,
      priceCurrency: event.offer.priceCurrency,
      area: event.offer.area,
      rooms: event.offer.rooms,
      imageUrl: images[0] ?? null,
      lat: Number((event.offer as { lat?: number | null }).lat) || null,
      lng: Number((event.offer as { lng?: number | null }).lng) || null,
    },
    recentBids: event.bids.map((b) => ({
      id: b.id,
      amount: b.amount,
      currency: b.currency,
      status: b.status as 'VALID' | 'OUTBID' | 'WINNING',
      createdAt: b.createdAt.toISOString(),
      bidderLabel: maskBidderLabel(b.userId, b.user.name, b.user.email, isHost),
      isMine: viewerUserId != null && b.userId === viewerUserId,
    })),
  };
}

async function syncAuctionStatus(eventId: number) {
  const event = await prisma.auctionEvent.findUnique({ where: { id: eventId } });
  if (!event) return;

  const now = new Date();
  const effectiveEnd = getEffectiveEndsAt(event);

  if (event.status === 'SCHEDULED' && now >= event.startsAt && now < effectiveEnd) {
    await prisma.auctionEvent.update({
      where: { id: eventId },
      data: { status: 'LIVE' },
    });
    return;
  }

  if ((event.status === 'SCHEDULED' || event.status === 'LIVE') && now >= effectiveEnd) {
    const met = reserveMet(event.reservePrice, event.currentPrice);
    const hasWinner = met && event.currentBidderUserId != null && event.bidCount > 0;
    await prisma.auctionEvent.update({
      where: { id: eventId },
      data: {
        status: hasWinner ? 'SETTLED' : 'ENDED',
        winnerUserId: hasWinner ? event.currentBidderUserId : null,
      },
    });
    if (hasWinner && event.currentBidderUserId) {
      void notifyAuctionEnded({
        eventId: event.id,
        offerId: event.offerId,
        hostUserId: event.hostUserId,
        winnerUserId: event.currentBidderUserId,
        finalAmount: event.currentPrice,
        currency: event.currency,
      });
    }
  }
}

async function loadAndSerialize(eventId: number, viewerUserId?: number | null) {
  await syncAuctionStatus(eventId);
  const event = await prisma.auctionEvent.findUnique({
    where: { id: eventId },
    include: eventInclude,
  });
  if (!event) return null;
  return serializeAuctionEvent(event as RawAuctionEvent, viewerUserId);
}

export async function getAuctionEventById(eventId: number, viewerUserId?: number | null) {
  await ensureAuctionSchema();
  return loadAndSerialize(eventId, viewerUserId);
}

export async function listHostAuctionEvents(hostUserId: number) {
  await ensureAuctionSchema();
  const events = await prisma.auctionEvent.findMany({
    where: { hostUserId },
    include: eventInclude,
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
  return Promise.all(
    events.map(async (e) => {
      await syncAuctionStatus(e.id);
      const fresh = await prisma.auctionEvent.findUnique({
        where: { id: e.id },
        include: eventInclude,
      });
      return serializeAuctionEvent(fresh as RawAuctionEvent, hostUserId);
    })
  );
}

export async function listLiveAuctionEvents(viewerUserId?: number | null) {
  await ensureAuctionSchema();
  const now = new Date();
  const events = await prisma.auctionEvent.findMany({
    where: {
      status: { in: ['SCHEDULED', 'LIVE'] },
      offer: { status: 'ACTIVE' },
      endsAt: { gt: now },
    },
    include: eventInclude,
    orderBy: [{ status: 'desc' }, { startsAt: 'asc' }],
    take: 40,
  });

  const serialized: AuctionEventRecord[] = [];
  for (const e of events) {
    await syncAuctionStatus(e.id);
    const fresh = await prisma.auctionEvent.findUnique({
      where: { id: e.id },
      include: eventInclude,
    });
    if (!fresh || !['SCHEDULED', 'LIVE'].includes(fresh.status)) continue;
    const effectiveEnd = getEffectiveEndsAt(fresh);
    if (effectiveEnd <= now) continue;
    serialized.push(serializeAuctionEvent(fresh as RawAuctionEvent, viewerUserId));
  }
  return serialized;
}

export async function listMyAuctionBids(userId: number) {
  await ensureAuctionSchema();
  const bids = await prisma.auctionBidEntry.findMany({
    where: { userId },
    include: {
      event: { include: eventInclude },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return bids
    .map((b) => {
      const event = b.event;
      if (!event) return null;
      return {
        bidId: b.id,
        amount: b.amount,
        currency: b.currency,
        status: b.status,
        createdAt: b.createdAt.toISOString(),
        event: serializeAuctionEvent(event as RawAuctionEvent, userId),
      };
    })
    .filter(Boolean);
}

export async function getActiveAuctionForOffer(offerId: number, viewerUserId?: number | null) {
  await ensureAuctionSchema();
  const event = await prisma.auctionEvent.findFirst({
    where: {
      offerId,
      status: { in: ['SCHEDULED', 'LIVE'] },
      offer: { status: 'ACTIVE' },
    },
    include: eventInclude,
    orderBy: { publishedAt: 'desc' },
  });
  if (!event) return null;
  await syncAuctionStatus(event.id);
  const fresh = await prisma.auctionEvent.findUnique({
    where: { id: event.id },
    include: eventInclude,
  });
  if (!fresh || !['SCHEDULED', 'LIVE'].includes(fresh.status)) return null;
  return serializeAuctionEvent(fresh as RawAuctionEvent, viewerUserId);
}

function validateAuctionWindow(startsAt: Date, endsAt: Date) {
  const now = Date.now();
  if (startsAt.getTime() <= now) throw new Error('STARTS_IN_PAST');
  if (endsAt <= startsAt) throw new Error('INVALID_WINDOW');
  const duration = endsAt.getTime() - startsAt.getTime();
  if (duration < MIN_AUCTION_DURATION_MS) throw new Error('DURATION_TOO_SHORT');
  if (duration > MAX_AUCTION_DURATION_MS) throw new Error('DURATION_TOO_LONG');
}

export async function createAuctionEvent(
  hostUserId: number,
  input: {
    offerId: number;
    title?: string | null;
    description?: string | null;
    startPrice: number;
    reservePrice?: number | null;
    minIncrement?: number | null;
    startsAt: string;
    endsAt: string;
    publish?: boolean;
  }
) {
  await ensureAuctionSchema();

  const offer = await prisma.offer.findFirst({
    where: { id: input.offerId, userId: hostUserId, status: 'ACTIVE' },
    select: { id: true, priceCurrency: true },
  });
  if (!offer) throw new Error('OFFER_NOT_FOUND');

  const startPrice = Number(input.startPrice);
  if (!Number.isFinite(startPrice) || startPrice <= 0) throw new Error('INVALID_START_PRICE');

  const reservePrice =
    input.reservePrice != null && Number(input.reservePrice) > 0
      ? Number(input.reservePrice)
      : null;
  if (reservePrice != null && reservePrice < startPrice) throw new Error('RESERVE_BELOW_START');

  const minIncrement =
    input.minIncrement != null && Number(input.minIncrement) > 0
      ? Number(input.minIncrement)
      : null;

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  validateAuctionWindow(startsAt, endsAt);

  const existing = await prisma.auctionEvent.findFirst({
    where: {
      offerId: input.offerId,
      status: { in: ['SCHEDULED', 'LIVE'] },
    },
  });
  if (existing) throw new Error('ALREADY_ACTIVE');

  const publish = input.publish !== false;
  const created = await prisma.auctionEvent.create({
    data: {
      offerId: input.offerId,
      hostUserId,
      title: input.title?.trim() || null,
      description: input.description?.trim() || null,
      currency: offer.priceCurrency || 'PLN',
      startPrice,
      reservePrice,
      minIncrement,
      currentPrice: 0,
      startsAt,
      endsAt,
      status: publish ? 'SCHEDULED' : 'DRAFT',
      publishedAt: publish ? new Date() : null,
    },
    include: eventInclude,
  });

  void notifyAuctionStartingSoon({
    eventId: created.id,
    offerId: created.offerId,
    hostUserId,
    startsAt: created.startsAt,
  });

  return serializeAuctionEvent(created as RawAuctionEvent, hostUserId);
}

export async function cancelAuctionEvent(hostUserId: number, eventId: number) {
  await ensureAuctionSchema();
  const event = await prisma.auctionEvent.findFirst({
    where: { id: eventId, hostUserId },
  });
  if (!event) throw new Error('NOT_FOUND');
  if (!['DRAFT', 'SCHEDULED', 'LIVE'].includes(event.status)) throw new Error('CANNOT_CANCEL');
  if (event.bidCount > 0 && event.status === 'LIVE') throw new Error('HAS_BIDS');

  await prisma.auctionEvent.update({
    where: { id: eventId },
    data: { status: 'CANCELLED' },
  });

  return loadAndSerialize(eventId, hostUserId);
}

export async function placeAuctionBid(
  userId: number,
  eventId: number,
  amountRaw: number
) {
  await ensureAuctionSchema();
  await syncAuctionStatus(eventId);

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_BID');

  const event = await prisma.auctionEvent.findUnique({
    where: { id: eventId },
    include: { offer: { select: { status: true } } },
  });
  if (!event) throw new Error('NOT_FOUND');
  if (event.hostUserId === userId) throw new Error('HOST_CANNOT_BID');
  if (event.offer.status !== 'ACTIVE') throw new Error('OFFER_INACTIVE');

  const now = new Date();
  let effectiveEnd = getEffectiveEndsAt(event);

  if (event.status === 'SCHEDULED' && now >= event.startsAt && now < effectiveEnd) {
    await prisma.auctionEvent.update({
      where: { id: eventId },
      data: { status: 'LIVE' },
    });
    event.status = 'LIVE';
  }

  if (event.status !== 'LIVE' && event.status !== 'SCHEDULED') throw new Error('AUCTION_CLOSED');
  if (now < event.startsAt) throw new Error('NOT_STARTED');
  if (now >= effectiveEnd) throw new Error('AUCTION_CLOSED');

  const displayPrice = event.currentPrice > 0 ? event.currentPrice : event.startPrice;
  const increment = computeMinIncrement(displayPrice, event.minIncrement);
  const minRequired = event.bidCount > 0 ? displayPrice + increment : event.startPrice;
  if (amount < minRequired) throw new Error('BID_TOO_LOW');

  const previousLeaderId = event.currentBidderUserId;

  let newExtendedEnd = event.extendedEndsAt;
  if (effectiveEnd.getTime() - now.getTime() <= ANTI_SNIPE_WINDOW_MS) {
    newExtendedEnd = new Date(effectiveEnd.getTime() + ANTI_SNIPE_EXTEND_MS);
  }

  await prisma.$transaction(async (tx) => {
    await tx.auctionBidEntry.updateMany({
      where: { eventId, status: 'WINNING' },
      data: { status: 'OUTBID' },
    });

    await tx.auctionBidEntry.create({
      data: {
        eventId,
        userId,
        amount,
        currency: event.currency,
        status: 'WINNING',
      },
    });

    await tx.auctionEvent.update({
      where: { id: eventId },
      data: {
        status: 'LIVE',
        currentPrice: amount,
        currentBidderUserId: userId,
        bidCount: { increment: 1 },
        extendedEndsAt: newExtendedEnd ?? undefined,
      },
    });
  });

  if (previousLeaderId && previousLeaderId !== userId) {
    void notifyAuctionOutbid({
      eventId,
      offerId: event.offerId,
      outbidUserId: previousLeaderId,
      newAmount: amount,
      currency: event.currency,
    });
  }

  void notifyAuctionBidPlaced({
    eventId,
    offerId: event.offerId,
    hostUserId: event.hostUserId,
    bidderUserId: userId,
    amount,
    currency: event.currency,
  });

  return loadAndSerialize(eventId, userId);
}

export async function buildAuctionTickerItems() {
  const events = await listLiveAuctionEvents();
  return events
    .filter((e) => e.timeRemainingMs > 0)
    .slice(0, 12)
    .map((e) => ({
      id: `auc-${e.id}`,
      type: 'AUCTION' as const,
      eventId: e.id,
      offerId: e.offerId,
      hostUserId: e.hostUserId,
      title: e.title,
      city: e.offer.city,
      district: e.offer.district,
      currentPrice: e.currentPrice,
      currency: e.currency,
      startsAt: e.startsAt,
      endsAt: e.effectiveEndsAt,
      status: e.status,
      bidCount: e.bidCount,
      imageUrl: e.offer.imageUrl,
      lat: e.offer.lat ?? null,
      lng: e.offer.lng ?? null,
    }));
}

export function mapAuctionError(error: unknown): { code: string; message: string; status: number } {
  const code = error instanceof Error ? error.message : 'UNKNOWN';
  switch (code) {
    case 'OFFER_NOT_FOUND':
      return { code, message: 'Nie znaleziono aktywnej oferty.', status: 404 };
    case 'INVALID_START_PRICE':
      return { code, message: 'Podaj poprawną cenę wywoławczą.', status: 400 };
    case 'RESERVE_BELOW_START':
      return { code, message: 'Cena minimalna nie może być niższa od ceny wywoławczej.', status: 400 };
    case 'STARTS_IN_PAST':
      return { code, message: 'Start licytacji musi być w przyszłości.', status: 400 };
    case 'INVALID_WINDOW':
      return { code, message: 'Data zakończenia musi być po starcie.', status: 400 };
    case 'DURATION_TOO_SHORT':
      return { code, message: 'Licytacja musi trwać co najmniej 1 godzinę.', status: 400 };
    case 'DURATION_TOO_LONG':
      return { code, message: 'Licytacja może trwać maksymalnie 14 dni.', status: 400 };
    case 'ALREADY_ACTIVE':
      return { code, message: 'Ta oferta ma już aktywną licytację.', status: 409 };
    case 'NOT_FOUND':
      return { code, message: 'Nie znaleziono licytacji.', status: 404 };
    case 'CANNOT_CANCEL':
    case 'HAS_BIDS':
      return { code, message: 'Nie można anulować tej licytacji.', status: 409 };
    case 'HOST_CANNOT_BID':
      return { code, message: 'Właściciel nie może licytować własnej oferty.', status: 403 };
    case 'OFFER_INACTIVE':
      return { code, message: 'Oferta nie jest aktywna.', status: 400 };
    case 'AUCTION_CLOSED':
      return { code, message: 'Licytacja zakończona.', status: 400 };
    case 'NOT_STARTED':
      return { code, message: 'Licytacja jeszcze się nie rozpoczęła — poczekaj na godzinę startu.', status: 400 };
    case 'INVALID_BID':
    case 'BID_TOO_LOW':
      return { code, message: 'Kwota oferty jest za niska.', status: 400 };
    default:
      return { code: 'UNKNOWN', message: 'Operacja nie powiodła się.', status: 500 };
  }
}
