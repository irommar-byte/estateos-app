import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { offerId, buyerId, type, date, amount } = body;

    if (!offerId || !buyerId || !type) {
      return NextResponse.json({ success: false, error: 'Brakujące dane' }, { status: 400 });
    }

    // Pobieramy ofertę
    const offer = await prisma.offer.findUnique({ where: { id: parseInt(offerId) } });
    if (!offer) return NextResponse.json({ success: false, error: 'Nie znaleziono oferty' }, { status: 404 });

    // Nie pozwalamy kupować od samego siebie
    if (offer.userId === parseInt(buyerId)) {
       return NextResponse.json({ success: false, error: 'To Twoja oferta' }, { status: 400 });
    }

    // Szukamy istniejącego Deal Roomu lub tworzymy nowy
    let deal = await prisma.deal.findFirst({
      where: { offerId: parseInt(offerId), buyerId: parseInt(buyerId) }
    });

    if (!deal) {
      deal = await prisma.deal.create({
        data: { offerId: parseInt(offerId), buyerId: parseInt(buyerId), sellerId: offer.userId }
      });
    }

    let messageContent = '';

    if (type === 'APPOINTMENT') {
      const appointment = await prisma.appointment.create({
        data: { dealId: deal.id, proposedById: parseInt(buyerId), proposedDate: new Date(date) }
      });
      messageContent = JSON.stringify({ action: 'APPOINTMENT', dataId: appointment.id, date });
    } 
    else if (type === 'BID') {
      const bid = await prisma.bid.create({
        data: { dealId: deal.id, senderId: parseInt(buyerId), amount: parseFloat(amount) }
      });
      messageContent = JSON.stringify({ action: 'BID', dataId: bid.id, amount });
    }

    // Wysyłamy wiadomość (Złotą Kartę) do Deal Roomu
    await prisma.dealMessage.create({
      data: { dealId: deal.id, senderId: parseInt(buyerId), content: messageContent }
    });

    // Zwracamy sukces (bez wywoływania nieistniejącej tabeli Notification)
    return NextResponse.json({ success: true, dealId: deal.id });

  } catch (error: any) {
    console.error('Błąd inicjacji Deal Roomu:', error.message);
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}
