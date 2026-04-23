import { decryptSession } from "@/lib/sessionUtils";
import { cookies } from "next/headers";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("estateos_session");

    if (!sessionCookie) {
      console.log("🔥 WYSYLAM DO CRM. Pokoje (deals):", typeof deals !== "undefined" ? deals?.length : "BŁĄD: Zmienna deals nie istnieje w tym miejscu!"); return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
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
      console.log("🔥 WYSYLAM DO CRM. Pokoje (deals):", typeof deals !== "undefined" ? deals?.length : "BŁĄD: Zmienna deals nie istnieje w tym miejscu!"); return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const finalUserId = user.id;

    // ==========================================
    // OFERTY
    // ==========================================
    const myOffers = await prisma.offer.findMany({
      where: { userId: finalUserId },
      orderBy: { createdAt: 'desc' }
    });

    const myOfferIds = myOffers.map(o => o.id);

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
      select: { id: true }
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
          { sellerId: finalUserId },
          { buyerId: finalUserId },
          { offerId: { in: myOfferIds } }
        ]
      },
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
      if (item.buyerId !== finalUserId) contactIds.add(item.buyerId);
      if (item.sellerId !== finalUserId) contactIds.add(item.sellerId);
    });

    const contactsData = await prisma.user.findMany({
      where: { id: { in: Array.from(contactIds) } },
      select: { id: true, name: true, image: true, phone: true, buyerType: true, email: true }
    });

    console.log("🔥 WYSYLAM DO CRM. Pokoje (deals):", typeof deals !== "undefined" ? deals?.length : "BŁĄD: Zmienna deals nie istnieje w tym miejscu!"); let finalDeals = [];
    try {
      const rawDeals = await prisma.deal.findMany({
        where: { OR: [{ sellerId: finalUserId }, { buyerId: finalUserId }] },
        include: { offer: true, buyer: true, seller: true },
        orderBy: { createdAt: 'desc' }
      });
      // Frontend używa zmiennej dealId (a baza daje po prostu id). Łączymy to!
      finalDeals = rawDeals.map(d => ({ ...d, dealId: d.id }));
    } catch(e) { console.error('Błąd pobierania pokoi:', e); }

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
    console.log("🔥 WYSYLAM DO CRM. Pokoje (deals):", typeof deals !== "undefined" ? deals?.length : "BŁĄD: Zmienna deals nie istnieje w tym miejscu!"); return NextResponse.json({ error: 'Błąd podczas pobierania danych CRM' }, { status: 500 });
  }
}
