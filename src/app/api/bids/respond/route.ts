import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { bidId, status } = await req.json();
    const bid = await prisma.bid.update({
      where: { id: bidId },
      data: { status }
    });

    await prisma.notification.create({
      data: {
        userId: bid.buyerId,
        title: status === 'ACCEPTED' ? '✅ Oferta Zakupu Zaakceptowana!' : '❌ Oferta Zakupu Odrzucona',
        message: status === 'ACCEPTED' ? `Gratulacje! Właściciel zaakceptował Twoją ofertę zakupu (${Number(bid.amount).toLocaleString('pl-PL')} PLN). Skontaktuj się w celu podpisania umowy.` : `Sprzedający odrzucił Twoją propozycję finansową. Możesz złożyć nową, wyższą ofertę.`,
        type: 'BID',
        link: status === 'ACCEPTED' ? '/moje-konto/crm?tab=transakcje' : '/moje-konto/crm'
      }
    });

    // MAGIA: Jeśli zaakceptowano, odpal Deal Room!
    if (status === 'ACCEPTED') {
       await prisma.dealMessage.create({
          data: {
             dealId: `${bid.offerId}_${bid.buyerId}`,
             senderId: "SYSTEM",
             senderName: "EstateOS",
             text: `Transakcja rozpoczęta. Strony zaakceptowały kwotę ${Number(bid.amount).toLocaleString('pl-PL')} PLN. Ten pokój służy do bezpiecznej wymiany dokumentów i finalizacji.`
          }
       });
    }

    return NextResponse.json({ success: true });
  } catch(e) {
    return NextResponse.json({ error: 'Błąd' }, { status: 500 });
  }
}
