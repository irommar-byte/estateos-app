import { decryptSession } from "@/lib/sessionUtils";
import { cookies } from "next/headers";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOfferPrimaryImage } from "@/lib/offers/primaryImage";

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

    const myOffers = myOffersRaw.map((offer) => ({
      ...offer,
      imageUrl: resolveOfferPrimaryImage(offer),
    }));

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
    const appointments = await prisma.appointment.findMany({
      where: {
        dealId: { in: dealIds }
      },
      include: {
        deal: true
      },
      orderBy: { proposedDate: 'asc' }
    });

    // ==========================================
    // LEADY
    // ==========================================
    const leads = await prisma.leadTransfer.findMany({
      where: {
        OR: [
          { agencyId: finalUserId },
          { ownerId: finalUserId }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

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

    appointments.forEach(item => {
      if (item.deal.buyerId !== finalUserId) contactIds.add(item.deal.buyerId);
      if (item.deal.sellerId !== finalUserId) contactIds.add(item.deal.sellerId);
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
      appointments,
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
