import { prisma } from '@/lib/prisma';
import type { UpcomingScheduleEvent } from '@/lib/crm/upcomingScheduleShared';

export type { UpcomingScheduleEvent } from '@/lib/crm/upcomingScheduleShared';
export { splitCountdown, eventCountdownState } from '@/lib/crm/upcomingScheduleShared';

const HORIZON_MS = 60 * 24 * 60 * 60 * 1000;
const GRACE_MS = 2 * 60 * 60 * 1000;

function formatLocation(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(', ');
}

function offerLocation(offer: {
  street?: string | null;
  district?: string | null;
  city?: string | null;
  title?: string | null;
} | null | undefined): string {
  if (!offer) return '';
  const loc = formatLocation([offer.street, offer.district, offer.city]);
  return loc || String(offer.title || '').trim();
}

export async function fetchUpcomingScheduleEvents(userId: number): Promise<UpcomingScheduleEvent[]> {
  const now = Date.now();
  const horizon = new Date(now + HORIZON_MS);
  const graceStart = new Date(now - GRACE_MS);

  const deals = await prisma.deal.findMany({
    where: {
      OR: [{ buyerId: userId }, { sellerId: userId }],
    },
    select: { id: true },
  });
  const dealIds = deals.map((d) => d.id);

  const appointmentsRaw =
    dealIds.length > 0
      ? await prisma.appointment.findMany({
          where: {
            dealId: { in: dealIds },
            status: { in: ['ACCEPTED', 'PENDING'] },
            proposedDate: { gte: graceStart, lte: horizon },
          },
          include: {
            deal: {
              include: {
                offer: {
                  select: {
                    id: true,
                    title: true,
                    street: true,
                    city: true,
                    district: true,
                  },
                },
              },
            },
          },
          orderBy: { proposedDate: 'asc' },
          take: 20,
        })
      : [];

  const presentationEvents: UpcomingScheduleEvent[] = appointmentsRaw.map((item) => {
    const offer = item.deal.offer;
    const loc = offerLocation(offer);
    const status = item.status === 'ACCEPTED' ? 'confirmed' : 'pending';
    return {
      id: `appt-${item.id}`,
      kind: 'presentation',
      title: status === 'confirmed' ? 'Prezentacja nieruchomości' : 'Propozycja prezentacji',
      subtitle: String(offer?.title || 'Spotkanie').trim(),
      location: loc,
      startsAt: item.proposedDate.toISOString(),
      endsAt: null,
      status,
      href: offer?.id ? `/oferta/${offer.id}` : `/moje-konto/crm?tab=planowanie`,
    };
  });

  const hostEventsRaw = await prisma.openHouseEvent.findMany({
    where: {
      hostUserId: userId,
      status: 'PUBLISHED',
      slots: {
        some: {
          startsAt: { gte: graceStart, lte: horizon },
        },
      },
    },
    include: {
      offer: {
        select: {
          id: true,
          title: true,
          street: true,
          city: true,
          district: true,
        },
      },
      slots: {
        where: { startsAt: { gte: graceStart, lte: horizon } },
        orderBy: { startsAt: 'asc' },
        take: 3,
      },
    },
    take: 10,
  });

  const openHouseHostEvents: UpcomingScheduleEvent[] = [];
  for (const event of hostEventsRaw) {
    for (const slot of event.slots) {
      openHouseHostEvents.push({
        id: `oh-host-${event.id}-${slot.id}`,
        kind: 'open_house_host',
        title: 'Dzień otwarty — organizator',
        subtitle: String(event.title || event.offer.title || 'Wydarzenie').trim(),
        location: offerLocation(event.offer),
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        status: 'confirmed',
        href: event.offer?.id ? `/oferta/${event.offer.id}` : '/moje-konto/crm',
      });
    }
  }

  const guestReservations = await prisma.openHouseReservation.findMany({
    where: {
      userId,
      status: 'CONFIRMED',
      slot: {
        startsAt: { gte: graceStart, lte: horizon },
        event: { status: 'PUBLISHED' },
      },
    },
    include: {
      slot: {
        include: {
          event: {
            include: {
              offer: {
                select: {
                  id: true,
                  title: true,
                  street: true,
                  city: true,
                  district: true,
                  images: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { slot: { startsAt: 'asc' } },
    take: 15,
  });

  const openHouseGuestEvents: UpcomingScheduleEvent[] = guestReservations
    .map((res) => {
      const slot = res.slot;
      const event = slot?.event;
      if (!slot || !event) return null;
      return {
        id: `oh-guest-${res.id}`,
        kind: 'open_house_guest' as const,
        title: 'Dzień otwarty — wizyta',
        subtitle: String(event.title || event.offer.title || 'Rezerwacja').trim(),
        location: offerLocation(event.offer),
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        status: 'confirmed' as const,
        href: event.offer?.id ? `/oferta/${event.offer.id}` : null,
      };
    })
    .filter(Boolean) as UpcomingScheduleEvent[];

  const merged = [...presentationEvents, ...openHouseHostEvents, ...openHouseGuestEvents].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  );

  const seen = new Set<string>();
  const unique: UpcomingScheduleEvent[] = [];
  for (const ev of merged) {
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    unique.push(ev);
  }

  return unique.slice(0, 8);
}
