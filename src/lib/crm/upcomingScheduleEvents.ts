import { prisma } from '@/lib/prisma';
import type { UpcomingScheduleEvent } from '@/lib/crm/upcomingScheduleShared';
import { resolveMeeting, resolvePresentation } from '@/lib/crm/clientJourney';

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

  const acquisitionRaw = await prisma.agencyClientActivity.findMany({
    where: {
      agencyUserId: userId,
      kind: {
        in: [
          'ACQUISITION_MEETING',
          'MEETING_CHANGE_PROPOSED',
          'MEETING_CONFIRMED',
          'PRESENTATION_PROPOSED',
          'PRESENTATION_CHANGE_PROPOSED',
          'PRESENTATION_CONFIRMED',
        ],
      },
    },
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
    },
    take: 250,
  });

  const grouped = new Map<number, typeof acquisitionRaw>();
  for (const row of acquisitionRaw) {
    const list = grouped.get(row.client.id) || [];
    list.push(row);
    grouped.set(row.client.id, list);
  }

  const acquisitionEvents: UpcomingScheduleEvent[] = [...grouped.values()].flatMap((rows) => {
    const seed = rows[0];
    const name = `${seed.client.firstName} ${seed.client.lastName}`.trim();
    const slots = [
      { kind: 'acquisition' as const, title: 'Spotkanie pozyskania', slot: resolveMeeting(rows) },
      { kind: 'presentation' as const, title: 'Prezentacja nieruchomości', slot: resolvePresentation(rows) },
    ];
    return slots
      .map(({ kind, title, slot }) => {
        if (!slot) return null;
        const t = new Date(slot.startsAt).getTime();
        if (Number.isNaN(t) || t < graceStart.getTime() || t > horizon.getTime()) return null;
        return {
          id: `${kind}-${seed.client.id}-${slot.startsAt}`,
          kind,
          title,
          subtitle: name,
          location: slot.location || '',
          startsAt: slot.startsAt,
          endsAt: new Date(t + 60 * 60 * 1000).toISOString(),
          status: slot.status,
          href: `/moje-konto/crm?tab=klienci&clientId=${seed.client.id}`,
        };
      })
      .filter(Boolean) as UpcomingScheduleEvent[];
  });

  const merged = [...presentationEvents, ...openHouseHostEvents, ...openHouseGuestEvents, ...acquisitionEvents].sort(
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
