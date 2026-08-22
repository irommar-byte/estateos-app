import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { ensureDeskSchema } from '@/lib/desk/ensureSchema';

/** Host Open House guests for an offer — for Desk convert-to-client. */
export async function GET(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  await ensureDeskSchema();
  const offerId = Number(new URL(req.url).searchParams.get('offerId'));
  if (!Number.isFinite(offerId)) {
    return NextResponse.json({ error: 'Brak offerId.' }, { status: 400 });
  }

  const offer = await prisma.offer.findFirst({
    where: { id: offerId, userId: agencyUserId },
    select: { id: true },
  });
  if (!offer) {
    return NextResponse.json({ error: 'Nie znaleziono oferty lub brak uprawnień.' }, { status: 404 });
  }

  const events = await prisma.openHouseEvent.findMany({
    where: { offerId, hostUserId: agencyUserId },
    include: {
      slots: {
        include: {
          reservations: {
            include: {
              user: { select: { id: true, name: true, email: true, phone: true } },
            },
          },
        },
      },
    },
    take: 5,
    orderBy: { id: 'desc' },
  });

  const guests = events.flatMap((ev) =>
    ev.slots.flatMap((slot) =>
      slot.reservations.map((r) => ({
        reservationId: r.id,
        eventId: ev.id,
        slotStartsAt: slot.startsAt,
        guestCount: r.guestCount,
        note: r.note,
        user: r.user,
      })),
    ),
  );

  const auctions = await prisma.auctionEvent.findMany({
    where: { offerId, hostUserId: agencyUserId },
    include: {
      bids: {
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      },
    },
    take: 3,
    orderBy: { id: 'desc' },
  });

  const bidders = auctions.flatMap((a) =>
    a.bids.map((b) => ({
      bidId: b.id,
      eventId: a.id,
      amount: b.amount,
      status: b.status,
      user: b.user,
    })),
  );

  return NextResponse.json({ success: true, guests, bidders, eventsCount: events.length });
}
