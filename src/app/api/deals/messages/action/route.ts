import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messageId, decision } = body;

    if (!messageId || !decision) {
      return NextResponse.json({ success: false, error: 'Brak danych' }, { status: 400 });
    }

    // Szukamy oryginalnej wiadomości (Smart Karty)
    const msg = await prisma.dealMessage.findUnique({ where: { id: parseInt(messageId) } });
    if (!msg) {
      return NextResponse.json({ success: false, error: 'Wiadomość nie istnieje' }, { status: 404 });
    }

    // Dekodujemy treść JSON, dopisujemy decyzję i pakujemy z powrotem
    let parsedContent = JSON.parse(msg.content);
    parsedContent.status = decision;

    // Aktualizujemy powiązane encje (dla pewności, ignorujemy błędy, jeśli pole status nie istnieje w bazie)
    if (parsedContent.action === 'BID' && parsedContent.dataId) {
        await prisma.bid.update({ where: { id: parsedContent.dataId }, data: { status: decision } }).catch(() => {});
    } else if (parsedContent.action === 'APPOINTMENT' && parsedContent.dataId) {
        await prisma.appointment.update({ where: { id: parsedContent.dataId }, data: { status: decision } }).catch(() => {});
    }

    // Zapisujemy odświeżoną kartę do historii czatu
    await prisma.dealMessage.update({
      where: { id: parseInt(messageId) },
      data: { content: JSON.stringify(parsedContent) }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Błąd akcji Deal Room:', error.message);
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}
