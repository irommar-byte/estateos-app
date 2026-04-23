import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('estateos_session');

    if (!session) {
      return NextResponse.json({ deals: [] });
    }

    let user: any = {};
    try {
      user = decryptSession(session.value);
    } catch (e) {}

    if (!user?.id) {
      return NextResponse.json({ deals: [] });
    }

    const messages = await prisma.dealMessage.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const dealsMap = new Map();

    for (const msg of messages) {
      if (!msg.dealId || !msg.dealId.includes("_")) continue;

      const parts = msg.dealId.split("_");
      if (parts.length !== 2) continue; // Tylko format X_Y
      const [offerId, buyerId] = parts;
      const parsedOfferId = parseInt(offerId);
      if (isNaN(parsedOfferId)) continue; // Blokada przed starymi śmieciowymi dealId

      const offer = await prisma.offer.findUnique({
        where: { id: parsedOfferId }
      });

      if (!offer) continue;

      const isBuyer = String(user.id) === buyerId;
      const isSeller = String(user.id) === String(offer.userId);

      // Jeśli nie jesteś ani kupcem ani sprzedawcą w tej ofercie - pomijamy
      if (!isBuyer && !isSeller) continue;

      // Zapisujemy tylko najnowszą wiadomość dla danego pokoju (grupowanie)
      if (!dealsMap.has(msg.dealId)) {
        dealsMap.set(msg.dealId, {
          dealId: msg.dealId,
          offer,
          lastMessage: msg.text,
          updatedAt: msg.createdAt
        });
      }
    }

    const deals = Array.from(dealsMap.values());
    return NextResponse.json({ deals });

  } catch (e) {
    console.error("Dealroom error: ", e);
    return NextResponse.json({ deals: [] }, { status: 500 });
  }
}
