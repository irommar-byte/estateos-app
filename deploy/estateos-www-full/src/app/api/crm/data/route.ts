import { Prisma } from '@prisma/client';
import { decryptSession } from "@/lib/sessionUtils";
import { cookies } from "next/headers";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOfferPrimaryImage } from "@/lib/offers/primaryImage";
import { listEnrichedLeadTransfersForUser } from "@/lib/leadTransfer";
import { acquisitionActivityToAppointment } from "@/lib/crm/planningCalendar";
import { resolveMeeting, resolvePresentation } from "@/lib/crm/clientJourney";

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("estateos_session");

    if (!sessionCookie) {
      return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
    }

    let emailToSearch = sessionCookie.value;

    try {
      const parsedSession = decryptSession(sessionCookie.value);
      if (parsedSession && parsedSession.email) {
        emailToSearch = parsedSession.email;
      }
    } catch {}

    const user = await prisma.user.findUnique({
      where: { email: emailToSearch },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const finalUserId = user.id;

    const [myOffersRaw, deals, acquisitionActs, leads, bids] = await Promise.all([
      prisma.offer.findMany({
        where: { userId: finalUserId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.deal.findMany({
        where: {
          OR: [
            { sellerId: finalUserId },
            { buyerId: finalUserId },
          ],
        },
        include: { offer: true, buyer: true, seller: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.agencyClientActivity.findMany({
        where: {
          agencyUserId: finalUserId,
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
          client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        },
        take: 250,
      }),
      listEnrichedLeadTransfersForUser(finalUserId),
      prisma.bid.findMany({
        where: {
          OR: [
            { senderId: finalUserId },
            { deal: { sellerId: finalUserId } },
            { deal: { buyerId: finalUserId } },
          ],
        },
        include: { deal: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const dealIds = deals.map((d) => d.id);
    const offerIds = myOffersRaw.map((offer) => offer.id);

    const [appointmentsRaw, pendingRows] = await Promise.all([
      dealIds.length
        ? prisma.appointment.findMany({
            where: { dealId: { in: dealIds } },
            include: {
              deal: {
                include: {
                  offer: true,
                  buyer: { select: { id: true, name: true, email: true, phone: true, image: true, companyName: true, role: true, planType: true } },
                  seller: { select: { id: true, name: true, email: true, phone: true, image: true, companyName: true, role: true, planType: true } },
                },
              },
              proposedBy: { select: { id: true, name: true, email: true } },
            },
            orderBy: { proposedDate: 'asc' },
          })
        : Promise.resolve([]),
      offerIds.length
        ? prisma.$queryRaw<Array<{ id: number; pendingPublicationKind: string | null }>>`
            SELECT id, pendingPublicationKind
            FROM Offer
            WHERE id IN (${Prisma.join(offerIds)})
          `
        : Promise.resolve([]),
    ]);

    const pendingByOfferId = new Map(
      pendingRows.map((row) => [Number(row.id), row.pendingPublicationKind]),
    );
    const myOffers = myOffersRaw.map((offer) => {
      const kind = pendingByOfferId.get(Number(offer.id));
      const pendingKind =
        kind === 'FREE_FIRST' || kind === 'PLUS_CREDIT' || kind === 'PLUS_PAID' ? kind : null;
      return {
        ...offer,
        imageUrl: resolveOfferPrimaryImage(offer),
        pendingPublicationKind: pendingKind,
        awaitingModeration: Boolean(pendingKind),
      };
    });

    const appointments = appointmentsRaw.map((item) => {
      const deal = item.deal;
      const offer = deal.offer;
      const counterparty =
        deal.buyerId === finalUserId ? deal.seller : deal.buyer;
      return {
        ...item,
        offerId: deal.offerId,
        buyerId: deal.buyerId,
        sellerId: deal.sellerId,
        offer: offer
          ? {
              id: offer.id,
              title: offer.title,
              street: offer.street,
              city: offer.city,
              district: offer.district,
              apartmentNumber: offer.apartmentNumber,
              price: offer.price,
              imageUrl: resolveOfferPrimaryImage(offer),
            }
          : null,
        counterparty,
      };
    });

    const grouped = new Map<number, typeof acquisitionActs>();
    for (const row of acquisitionActs) {
      const list = grouped.get(row.client.id) || [];
      list.push(row);
      grouped.set(row.client.id, list);
    }
    const acquisitionAppointments = [...grouped.values()].flatMap((rows) => {
      const seed = rows[rows.length - 1];
      const meeting = resolveMeeting(rows);
      const presentation = resolvePresentation(rows);
      const out = [];
      if (meeting) {
        const mapped = acquisitionActivityToAppointment({
          ...seed,
          kind: meeting.status === 'pending' ? 'MEETING_CHANGE_PROPOSED' : 'ACQUISITION_MEETING',
          title: `Pozyskanie · ${seed.client.firstName} ${seed.client.lastName}`.trim(),
          body: meeting.reason || meeting.notes,
          metadata: meeting,
        });
        if (mapped) out.push(mapped);
      }
      if (presentation) {
        const mapped = acquisitionActivityToAppointment({
          ...seed,
          id: seed.id + 1_000_000,
          kind: presentation.status === 'pending' ? 'PRESENTATION_CHANGE_PROPOSED' : 'PRESENTATION_CONFIRMED',
          title: `Prezentacja · ${seed.client.firstName} ${seed.client.lastName}`.trim(),
          body: presentation.reason || presentation.notes,
          metadata: presentation,
        });
        if (mapped) out.push(mapped);
      }
      return out;
    });
    const allAppointments = [...appointments, ...acquisitionAppointments];

    const contactIds = new Set<number>();

    allAppointments.forEach(item => {
      if ('deal' in item && item.deal) {
        const buyerId = Number(item.deal.buyerId);
        const sellerId = Number(item.deal.sellerId);
        if (Number.isFinite(buyerId) && buyerId !== finalUserId) contactIds.add(buyerId);
        if (Number.isFinite(sellerId) && sellerId !== finalUserId) contactIds.add(sellerId);
      }
    });

    bids.forEach(item => {
      if (item.deal.buyerId !== finalUserId) contactIds.add(item.deal.buyerId);
      if (item.deal.sellerId !== finalUserId) contactIds.add(item.deal.sellerId);
      if (item.senderId !== finalUserId) contactIds.add(item.senderId);
    });

    const contactsData = await prisma.user.findMany({
      where: { id: { in: Array.from(contactIds) } },
      select: { id: true, name: true, image: true, phone: true, email: true }
    });

    // Frontend używa zmiennej dealId (a baza daje po prostu id). Łączymy to.
    const finalDeals = deals.map((d) => ({ ...d, dealId: d.id }));

    return NextResponse.json({
      deals: finalDeals,
      appointments: allAppointments,
      bids,
      leads,
      offers: myOffers,
      contacts: contactsData,
      
    });

  } catch (error) {
    console.error("CRM Data Error:", error);
    return NextResponse.json({ error: 'Błąd podczas pobierania danych CRM' }, { status: 500 });
  }
}
