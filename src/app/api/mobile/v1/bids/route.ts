import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

function getUserIdFromAuthHeader(authHeader: string | null): number | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const decoded = jwt.decode(token) as any;
  const id = Number(decoded?.id || decoded?.userId || decoded?.sub);
  return Number.isFinite(id) ? id : null;
}

export async function POST(req: Request) {
  try {
    const buyerId = getUserIdFromAuthHeader(req.headers.get('authorization'));
    if (!buyerId) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

    const body = await req.json();
    const offerId = Number(body?.offerId);
    const amount = Number(body?.amount);
    const financingRaw = String(body?.financing || 'CASH').toUpperCase();
    const financing = financingRaw === 'CREDIT' ? 'CREDIT' : 'CASH';

    if (!offerId || Number.isNaN(offerId)) return NextResponse.json({ error: 'Nieprawidłowe ID oferty' }, { status: 400 });
    if (!amount || Number.isNaN(amount) || amount <= 0) return NextResponse.json({ error: 'Podaj poprawną kwotę oferty' }, { status: 400 });

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true, userId: true, status: true }
    });

    if (!offer) return NextResponse.json({ error: 'Oferta nie istnieje' }, { status: 404 });
    if (offer.userId === buyerId) return NextResponse.json({ error: 'Nie możesz złożyć oferty na własną nieruchomość' }, { status: 400 });
    if (offer.status !== 'ACTIVE') return NextResponse.json({ error: 'Ta oferta nie jest aktywna' }, { status: 403 });

    const result = await prisma.$transaction(async (tx) => {
      const deal = await tx.deal.upsert({
        where: { offerId_buyerId: { offerId, buyerId } },
        update: { isActive: true, status: 'NEGOTIATION', updatedAt: new Date() },
        create: { offerId, buyerId, sellerId: offer.userId, status: 'NEGOTIATION', isActive: true }
      });

      const bid = await tx.bid.create({
        data: {
          dealId: deal.id,
          senderId: buyerId,
          amount,
          message: financing === 'CASH' ? 'Finansowanie: Gotówka' : 'Finansowanie: Kredyt bankowy',
          status: 'PENDING'
        }
      });

      await tx.dealMessage.create({
        data: {
          dealId: deal.id,
          senderId: buyerId,
          content: `Złożono oficjalną ofertę zakupu: ${amount.toLocaleString('pl-PL')} PLN (${financing === 'CASH' ? 'gotówka' : 'kredyt bankowy'}).`
        }
      });

      await tx.notification.create({
        data: {
          userId: offer.userId,
          title: 'Nowa oferta zakupu',
          body: `Kupiec złożył ofertę ${amount.toLocaleString('pl-PL')} PLN.`,
          type: 'BID_RECEIVED',
          targetType: 'DEAL',
          targetId: String(deal.id)
        }
      });

      return { deal, bid };
    });

    return NextResponse.json({ success: true, dealId: result.deal.id, bidId: result.bid.id });
  } catch (error) {
    console.error('MOBILE BID ERROR:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
