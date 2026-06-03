import { prisma } from '@/lib/prisma';

export type OpenHouseSlotInput = {
  startsAt: string;
  endsAt: string;
  capacity?: number;
};

export type OpenHouseVisitMode = 'FLEX' | 'SLOT_30' | 'SLOT_60';

export function parseOpenHouseVisitMode(raw: unknown): OpenHouseVisitMode {
  if (raw === 'SLOT_30' || raw === 'SLOT_60') return raw;
  return 'FLEX';
}

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
  lat: true,
  lng: true,
  status: true,
  userId: true,
} as const;

function parseImages(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function countConfirmedReservations(
  reservations: Array<{ status: string; guestCount: number }>
): number {
  return reservations
    .filter((r) => r.status === 'CONFIRMED')
    .reduce((sum, r) => sum + Math.max(1, r.guestCount || 1), 0);
}

export function serializeOpenHouseSlot(slot: {
  id: number;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  reservations: Array<{
    id: number;
    userId: number;
    guestCount: number;
    status: string;
    note: string | null;
    createdAt: Date;
    user?: { id: number; name: string | null; email: string; phone: string | null } | null;
  }>;
}, viewerUserId?: number | null) {
  const reservedCount = countConfirmedReservations(slot.reservations);
  const spotsLeft = Math.max(0, slot.capacity - reservedCount);
  const myReservation = viewerUserId
    ? slot.reservations.find(
        (r) => r.userId === viewerUserId && r.status === 'CONFIRMED'
      ) ?? null
    : null;

  return {
    id: slot.id,
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
    capacity: slot.capacity,
    reservedCount,
    spotsLeft,
    isFull: spotsLeft <= 0,
    myReservation: myReservation
      ? {
          id: myReservation.id,
          guestCount: myReservation.guestCount,
          note: myReservation.note,
          createdAt: myReservation.createdAt.toISOString(),
        }
      : null,
    reservations: slot.reservations
      .filter((r) => r.status === 'CONFIRMED')
      .map((r) => ({
        id: r.id,
        userId: r.userId,
        guestCount: r.guestCount,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
        userName: r.user?.name || r.user?.email?.split('@')[0] || 'Gość',
      })),
  };
}

export function serializeOpenHouseEvent(
  event: {
    id: number;
    offerId: number;
    hostUserId: number;
    title: string | null;
    description: string | null;
    visitMode: string;
    status: string;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
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
      propertyType: string;
      transactionType: string;
      images: string | null;
      lat: number | null;
      lng: number | null;
      status: string;
      userId: number;
    };
    host?: { id: number; name: string | null; email: string; phone: string | null } | null;
    slots: Array<{
      id: number;
      startsAt: Date;
      endsAt: Date;
      capacity: number;
      reservations: Array<{
        id: number;
        userId: number;
        guestCount: number;
        status: string;
        note: string | null;
        createdAt: Date;
        user?: { id: number; name: string | null; email: string; phone: string | null } | null;
      }>;
    }>;
  },
  viewerUserId?: number | null
) {
  const images = parseImages(event.offer.images);
  const slots = event.slots
    .slice()
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((slot) => serializeOpenHouseSlot(slot, viewerUserId));

  const nextSlot = slots.find((s) => new Date(s.startsAt).getTime() > Date.now() && !s.isFull) ?? null;
  const totalSpotsLeft = slots.reduce((sum, s) => sum + s.spotsLeft, 0);

  return {
    id: event.id,
    offerId: event.offerId,
    hostUserId: event.hostUserId,
    title: event.title || event.offer.title,
    description: event.description,
    visitMode: parseOpenHouseVisitMode(event.visitMode),
    status: event.status,
    publishedAt: event.publishedAt?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    isHost: viewerUserId != null && viewerUserId === event.hostUserId,
    nextSlotStartsAt: nextSlot?.startsAt ?? null,
    totalSpotsLeft,
    host: event.host
      ? {
          id: event.host.id,
          name: event.host.name,
          email: event.host.email,
          phone: event.host.phone,
        }
      : null,
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
      propertyType: event.offer.propertyType,
      transactionType: event.offer.transactionType,
      imageUrl: images[0] ?? null,
      lat: event.offer.lat,
      lng: event.offer.lng,
      status: event.offer.status,
    },
    slots,
  };
}

const eventInclude = {
  offer: { select: OFFER_SELECT },
  host: { select: { id: true, name: true, email: true, phone: true } },
  slots: {
    orderBy: { startsAt: 'asc' as const },
    include: {
      reservations: {
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      },
    },
  },
};

export async function getOpenHouseEventById(eventId: number, viewerUserId?: number | null) {
  const event = await prisma.openHouseEvent.findUnique({
    where: { id: eventId },
    include: eventInclude,
  });
  if (!event) return null;
  return serializeOpenHouseEvent(event, viewerUserId);
}

export async function listPublishedOpenHouseEvents(viewerUserId?: number | null) {
  const now = new Date();
  const events = await prisma.openHouseEvent.findMany({
    where: {
      status: 'PUBLISHED',
      offer: { status: 'ACTIVE' },
      slots: { some: { endsAt: { gt: now } } },
    },
    include: eventInclude,
    orderBy: { publishedAt: 'desc' },
    take: 40,
  });
  return events.map((e) => serializeOpenHouseEvent(e, viewerUserId));
}

export async function listHostOpenHouseEvents(hostUserId: number) {
  const events = await prisma.openHouseEvent.findMany({
    where: { hostUserId },
    include: eventInclude,
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
  return events.map((e) => serializeOpenHouseEvent(e, hostUserId));
}

export async function listMyOpenHouseReservations(userId: number) {
  const reservations = await prisma.openHouseReservation.findMany({
    where: { userId, status: 'CONFIRMED' },
    include: {
      slot: {
        include: {
          event: {
            include: eventInclude,
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return reservations
    .map((r) => {
      const event = r.slot?.event;
      if (!event) return null;
      const serialized = serializeOpenHouseEvent(event, userId);
      return {
        reservationId: r.id,
        guestCount: r.guestCount,
        note: r.note,
        slotId: r.slotId,
        startsAt: r.slot.startsAt.toISOString(),
        endsAt: r.slot.endsAt.toISOString(),
        event: serialized,
      };
    })
    .filter(Boolean);
}

export async function getPublishedEventForOffer(offerId: number, viewerUserId?: number | null) {
  const event = await prisma.openHouseEvent.findFirst({
    where: {
      offerId,
      status: 'PUBLISHED',
      offer: { status: 'ACTIVE' },
    },
    include: eventInclude,
    orderBy: { publishedAt: 'desc' },
  });
  if (!event) return null;
  return serializeOpenHouseEvent(event, viewerUserId);
}

function expandSlotWindows(
  windows: Array<{ startsAt: Date; endsAt: Date; capacity: number }>,
  mode: OpenHouseVisitMode
) {
  if (mode === 'FLEX') return windows;

  const stepMs = mode === 'SLOT_30' ? 30 * 60 * 1000 : 60 * 60 * 1000;
  const expanded: Array<{ startsAt: Date; endsAt: Date; capacity: number }> = [];

  for (const window of windows) {
    let cursor = window.startsAt.getTime();
    const endMs = window.endsAt.getTime();
    while (cursor + stepMs <= endMs) {
      expanded.push({
        startsAt: new Date(cursor),
        endsAt: new Date(cursor + stepMs),
        capacity: window.capacity,
      });
      cursor += stepMs;
    }
  }

  return expanded;
}

export async function createOpenHouseEvent(
  hostUserId: number,
  input: {
    offerId: number;
    title?: string | null;
    description?: string | null;
    visitMode?: OpenHouseVisitMode | string | null;
    slots: OpenHouseSlotInput[];
    publish?: boolean;
  }
) {
  const offer = await prisma.offer.findFirst({
    where: { id: input.offerId, userId: hostUserId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!offer) {
    throw new Error('OFFER_NOT_FOUND');
  }

  const visitMode = parseOpenHouseVisitMode(input.visitMode);
  const windows = normalizeSlots(input.slots);
  const slots = expandSlotWindows(windows, visitMode);
  if (!slots.length) {
    throw new Error('SLOTS_REQUIRED');
  }
  if (slots.length > 48) {
    throw new Error('TOO_MANY_SLOTS');
  }

  const existingPublished = await prisma.openHouseEvent.findFirst({
    where: { offerId: input.offerId, status: 'PUBLISHED' },
    select: { id: true },
  });
  if (existingPublished && input.publish !== false) {
    throw new Error('ALREADY_PUBLISHED');
  }

  const event = await prisma.openHouseEvent.create({
    data: {
      offerId: input.offerId,
      hostUserId,
      title: input.title?.trim() || null,
      description: input.description?.trim() || null,
      visitMode,
      status: input.publish ? 'PUBLISHED' : 'DRAFT',
      publishedAt: input.publish ? new Date() : null,
      slots: {
        create: slots,
      },
    },
    include: eventInclude,
  });

  return serializeOpenHouseEvent(event, hostUserId);
}

export async function updateOpenHouseEvent(
  hostUserId: number,
  eventId: number,
  input: {
    title?: string | null;
    description?: string | null;
    status?: 'DRAFT' | 'PUBLISHED' | 'CANCELLED';
    replaceSlots?: OpenHouseSlotInput[];
  }
) {
  const event = await prisma.openHouseEvent.findFirst({
    where: { id: eventId, hostUserId },
    include: { slots: { include: { reservations: true } } },
  });
  if (!event) throw new Error('NOT_FOUND');

  if (input.replaceSlots) {
    const hasConfirmed = event.slots.some((s) =>
      s.reservations.some((r) => r.status === 'CONFIRMED')
    );
    if (hasConfirmed) throw new Error('HAS_RESERVATIONS');

    await prisma.$transaction([
      prisma.openHouseSlot.deleteMany({ where: { eventId } }),
      prisma.openHouseSlot.createMany({
        data: normalizeSlots(input.replaceSlots).map((slot) => ({ ...slot, eventId })),
      }),
    ]);
  }

  const updated = await prisma.openHouseEvent.update({
    where: { id: eventId },
    data: {
      title: input.title !== undefined ? input.title?.trim() || null : undefined,
      description: input.description !== undefined ? input.description?.trim() || null : undefined,
      status: input.status,
      publishedAt:
        input.status === 'PUBLISHED' && !event.publishedAt ? new Date() : undefined,
    },
    include: eventInclude,
  });

  return serializeOpenHouseEvent(updated, hostUserId);
}

export async function reserveOpenHouseSlot(
  userId: number,
  slotId: number,
  input: { guestCount?: number; note?: string | null }
) {
  const guestCount = Math.min(10, Math.max(1, Number(input.guestCount) || 1));

  return prisma.$transaction(async (tx) => {
    const slot = await tx.openHouseSlot.findUnique({
      where: { id: slotId },
      include: {
        reservations: { where: { status: 'CONFIRMED' } },
        event: { include: { offer: { select: { status: true } } } },
      },
    });
    if (!slot) throw new Error('SLOT_NOT_FOUND');
    if (slot.event.status !== 'PUBLISHED') throw new Error('EVENT_NOT_PUBLISHED');
    if (slot.event.offer.status !== 'ACTIVE') throw new Error('OFFER_INACTIVE');
    if (slot.endsAt <= new Date()) throw new Error('SLOT_PAST');

    const reserved = countConfirmedReservations(slot.reservations);
    if (reserved + guestCount > slot.capacity) throw new Error('SLOT_FULL');

    const existing = await tx.openHouseReservation.findUnique({
      where: { slotId_userId: { slotId, userId } },
    });
    if (existing?.status === 'CONFIRMED') throw new Error('ALREADY_RESERVED');

    const reservation = existing
      ? await tx.openHouseReservation.update({
          where: { id: existing.id },
          data: {
            status: 'CONFIRMED',
            guestCount,
            note: input.note?.trim() || null,
          },
        })
      : await tx.openHouseReservation.create({
          data: {
            slotId,
            userId,
            guestCount,
            note: input.note?.trim() || null,
          },
        });

    const event = await tx.openHouseEvent.findUnique({
      where: { id: slot.eventId },
      include: eventInclude,
    });
    if (!event) throw new Error('NOT_FOUND');

    return {
      reservation: {
        id: reservation.id,
        slotId: reservation.slotId,
        guestCount: reservation.guestCount,
        note: reservation.note,
        createdAt: reservation.createdAt.toISOString(),
      },
      event: serializeOpenHouseEvent(event, userId),
    };
  });
}

export async function cancelOpenHouseReservation(userId: number, reservationId: number) {
  const reservation = await prisma.openHouseReservation.findFirst({
    where: { id: reservationId, userId, status: 'CONFIRMED' },
    include: { slot: { select: { eventId: true } } },
  });
  if (!reservation) throw new Error('NOT_FOUND');

  await prisma.openHouseReservation.update({
    where: { id: reservationId },
    data: { status: 'CANCELLED' },
  });

  const event = await getOpenHouseEventById(reservation.slot.eventId, userId);
  return event;
}

export async function buildOpenHouseTickerItems() {
  const events = await listPublishedOpenHouseEvents();
  const now = Date.now();

  return events
    .filter((e) => e.nextSlotStartsAt && new Date(e.nextSlotStartsAt).getTime() > now)
    .slice(0, 12)
    .map((e) => ({
      id: `oh-${e.id}`,
      type: 'OPEN_HOUSE' as const,
      eventId: e.id,
      offerId: e.offerId,
      title: e.title,
      city: e.offer.city,
      district: e.offer.district,
      startsAt: e.nextSlotStartsAt,
      spotsLeft: e.totalSpotsLeft,
      imageUrl: e.offer.imageUrl,
    }));
}

function normalizeSlots(slots: OpenHouseSlotInput[]) {
  const now = Date.now();
  const normalized = slots
    .map((slot) => {
      const startsAt = new Date(slot.startsAt);
      const endsAt = new Date(slot.endsAt);
      const capacity = Math.min(50, Math.max(1, Number(slot.capacity) || 8));
      if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) return null;
      if (endsAt <= startsAt) return null;
      if (endsAt.getTime() <= now) return null;
      return { startsAt, endsAt, capacity };
    })
    .filter(Boolean) as Array<{ startsAt: Date; endsAt: Date; capacity: number }>;

  return normalized;
}

export function mapOpenHouseError(error: unknown): { code: string; message: string; status: number } {
  const code = error instanceof Error ? error.message : 'UNKNOWN';
  switch (code) {
    case 'OFFER_NOT_FOUND':
      return { code, message: 'Nie znaleziono aktywnej oferty.', status: 404 };
    case 'SLOTS_REQUIRED':
      return { code, message: 'Dodaj co najmniej jeden termin.', status: 400 };
    case 'TOO_MANY_SLOTS':
      return {
        code,
        message: 'Za dużo terminów — skróć okno czasowe lub wybierz rzadsze sloty.',
        status: 400,
      };
    case 'ALREADY_PUBLISHED':
      return { code, message: 'Ta oferta ma już opublikowany dzień otwarty.', status: 409 };
    case 'NOT_FOUND':
    case 'SLOT_NOT_FOUND':
      return { code, message: 'Nie znaleziono wydarzenia.', status: 404 };
    case 'HAS_RESERVATIONS':
      return { code, message: 'Nie można zmienić terminów — są już rezerwacje.', status: 409 };
    case 'EVENT_NOT_PUBLISHED':
      return { code, message: 'Wydarzenie nie jest opublikowane.', status: 400 };
    case 'OFFER_INACTIVE':
      return { code, message: 'Oferta nie jest aktywna.', status: 400 };
    case 'SLOT_PAST':
      return { code, message: 'Ten termin już minął.', status: 400 };
    case 'SLOT_FULL':
      return { code, message: 'Brak wolnych miejsc w tym terminie.', status: 409 };
    case 'ALREADY_RESERVED':
      return { code, message: 'Masz już rezerwację w tym terminie.', status: 409 };
    default:
      return { code: 'UNKNOWN', message: 'Operacja nie powiodła się.', status: 500 };
  }
}
