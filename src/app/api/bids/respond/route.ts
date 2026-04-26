import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { bidId, status } = await req.json();
    const bid = await prisma.bid.update({
      where: { id: bidId },
      data: { status }
    });
    const bidWithDeal = await prisma.bid.findUnique({
      where: { id: bid.id },
      include: { deal: true },
    });
    if (!bidWithDeal) return NextResponse.json({ error: 'Brak oferty' }, { status: 404 });

    const buyerId = bidWithDeal.deal.buyerId;

    await prisma.notification.create({
      data: {
        userId: buyerId,
        title: status === 'ACCEPTED' ? '✅ Oferta Zakupu Zaakceptowana!' : '❌ Oferta Zakupu Odrzucona',
        body: status === 'ACCEPTED' ? `Gratulacje! Właściciel zaakceptował Twoją ofertę zakupu (${Number(bid.amount).toLocaleString('pl-PL')} PLN). Skontaktuj się w celu podpisania umowy.` : `Sprzedający odrzucił Twoją propozycję finansową. Możesz złożyć nową, wyższą ofertę.`,
        type: 'BID_RECEIVED',
        targetType: 'DEAL',
        targetId: String(bidWithDeal.dealId),
      }
    });

    // MAGIA: Jeśli zaakceptowano, odpal Deal Room!
    if (status === 'ACCEPTED') {
       await prisma.dealMessage.create({
          data: {
             dealId: bidWithDeal.dealId,
             senderId: bid.senderId,
             content: `Transakcja rozpoczęta. Strony zaakceptowały kwotę ${Number(bid.amount).toLocaleString('pl-PL')} PLN. Ten pokój służy do bezpiecznej wymiany dokumentów i finalizacji.`
          }
       });
    }

    return NextResponse.json({ success: true });
  } catch(e) {
    return NextResponse.json({ error: 'Błąd' }, { status: 500 });
  }
}
