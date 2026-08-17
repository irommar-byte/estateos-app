import { decryptSession } from "@/lib/sessionUtils";
import { cookies } from "next/headers";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOfferPrimaryImage } from "@/lib/offers/primaryImage";
import { readPendingPublication } from "@/lib/offerPendingPublication";
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
      where: { email: emailToSearch }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const finalUserId = user.id;

    // ==========================================
    // OFERTY
    // ==========================================
    const myOffersRaw = await prisma.offer.findMany({
      where: { userId: finalUserId },
      orderBy: { createdAt: 'desc' }
    });

    const myOffers = await Promise.all(
      myOffersRaw.map(async (offer) => {
        const pending = await readPendingPublication(Number(offer.id));
        return {
          ...offer,
          imageUrl: resolveOfferPrimaryImage(offer),
          pendingPublicationKind: pending?.kind ?? null,
          awaitingModeration: Boolean(pending?.kind),
        };
      }),
    );

    // ==========================================
    // DEALS (🔥 KLUCZOWY FIX)
    // ==========================================
    const deals = await prisma.deal.findMany({
      where: {
        OR: [
          { sellerId: finalUserId },
          { buyerId: finalUserId }
        ]
      },
      include: { offer: true, buyer: true, seller: true },
      orderBy: { createdAt: 'desc' }
    });

    const dealIds = deals.map(d => d.id);

    // ==========================================
    // APPOINTMENTS (🔥 POPRAWIONE)
    // ==========================================
    const appointmentsRaw = await prisma.appointment.findMany({
      where: {
        dealId: { in: dealIds }
      },
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
      orderBy: { proposedDate: 'asc' }
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

    const acquisitionActs = await prisma.agencyClientActivity.findMany({
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

    // ==========================================
    // LEADY
    // ==========================================
    const leads = await listEnrichedLeadTransfersForUser(finalUserId);

    // ==========================================
    // BIDS
    // ==========================================
    const bids = await prisma.bid.findMany({
      where: {
        OR: [
          { senderId: finalUserId },
          { deal: { sellerId: finalUserId } },
          { deal: { buyerId: finalUserId } },
        ]
      },
      include: { deal: true },
      orderBy: { createdAt: 'desc' }
    });

    // ==========================================
    // KONTAKTY
    // ==========================================
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
