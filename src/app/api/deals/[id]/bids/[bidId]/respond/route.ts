import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

// ================================
// AUTH HELPER
// ================================
function getUserIdFromToken(authHeader: string | null): number | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const payload = jwt.verify(token, secret) as any;
    return Number(payload?.id || payload?.sub) || null;
  } catch {
    return null;
  }
}

// ================================
// RESPOND TO BID
// ================================
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string; bidId: string }> }
) {
  try {
    const { id, bidId: rawBidId } = await context.params;
    const dealId = Number(id);
    const bidId = Number(rawBidId);

    // ❗ WALIDACJA ID
    if (!dealId || isNaN(dealId) || !bidId || isNaN(bidId)) {
      return NextResponse.json({ error: 'Nieprawidłowe ID' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization');
    const userId = getUserIdFromToken(authHeader);

    if (!userId) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const { action } = await req.json(); // 'ACCEPT' | 'REJECT'

    if (action !== 'ACCEPT' && action !== 'REJECT') {
      return NextResponse.json({ error: 'Nieznana akcja' }, { status: 400 });
    }

    // 🔍 DEAL + BID
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { offer: true }
    });

    const bid = await prisma.bid.findUnique({
      where: { id: bidId }
    });

    if (!deal || !bid || bid.dealId !== dealId) {
      return NextResponse.json({ error: 'Nie znaleziono danych' }, { status: 404 });
    }

    // ❗ BLOKADY LOGICZNE
    if (!deal.isActive) {
      return NextResponse.json({ error: 'Transakcja jest zamknięta' }, { status: 400 });
    }

    if (deal.acceptedBidId) {
      return NextResponse.json({ error: 'Oferta została już zaakceptowana' }, { status: 400 });
    }

    if (deal.buyerId !== userId && deal.sellerId !== userId) {
      return NextResponse.json({ error: 'Brak dostępu do tego pokoju' }, { status: 403 });
    }

    if (bid.senderId === userId) {
      return NextResponse.json({ error: 'Nie możesz reagować na własną ofertę' }, { status: 403 });
    }

    if (bid.status !== 'PENDING' && bid.status !== 'COUNTER_OFFER') {
      return NextResponse.json({ error: 'Ta oferta została już rozpatrzona' }, { status: 400 });
    }

    const senderOfBid = bid.senderId;

    if (!senderOfBid) {
      return NextResponse.json({ error: 'Błąd danych' }, { status: 500 });
    }

    // ================================
    // 🔥 TRANSAKCJA
    // ================================
    await prisma.$transaction(async (tx) => {

      if (action === 'ACCEPT') {

        // A. Akceptacja
        await tx.bid.update({
          where: { id: bidId },
          data: { status: 'ACCEPTED' }
        });

        // 🔥 Zamknięcie wszystkich innych ofert
        await tx.bid.updateMany({
          where: {
            dealId,
            id: { not: bidId }
          },
          data: { status: 'REJECTED' }
        });

        // B. Update DEAL
        await tx.deal.update({
          where: { id: dealId },
          data: {
            status: 'AGREED',
            acceptedBidId: bidId,
            isActive: false
          }
        });

        // C. Update OFFER
        await tx.offer.update({
          where: { id: deal.offerId },
          data: { status: 'IN_DEAL' }
        });

        // D. SYSTEM MESSAGE
        await tx.dealMessage.create({
          data: {
            dealId,
            senderId: userId,
            content: `[SYSTEM_BID_ACCEPTED:${bidId}] Oferta ${bid.amount} PLN została zaakceptowana 🎉`
          }
        });

        // E. NOTIFICATION
        await tx.notification.create({
          data: {
            userId: senderOfBid,
            type: 'BID_RECEIVED',
            title: '✅ Oferta zaakceptowana',
            body: `Twoja oferta ${bid.amount} PLN została przyjęta.`,
            targetType: 'DEAL',
            targetId: String(dealId),
          }
        });

      } else {

        // A. Odrzucenie
        await tx.bid.update({
          where: { id: bidId },
          data: { status: 'REJECTED' }
        });

        // B. SYSTEM MESSAGE
        await tx.dealMessage.create({
          data: {
            dealId,
            senderId: userId,
            content: `[SYSTEM_BID_REJECTED:${bidId}] Oferta ${bid.amount} PLN została odrzucona`
          }
        });

        // C. NOTIFICATION
        await tx.notification.create({
          data: {
            userId: senderOfBid,
            type: 'BID_RECEIVED',
            title: '❌ Oferta odrzucona',
            body: `Twoja oferta ${bid.amount} PLN została odrzucona.`,
            targetType: 'DEAL',
            targetId: String(dealId),
          }
        });

      }
    });

    return NextResponse.json({
      success: true,
      message: action === 'ACCEPT' ? 'Oferta zaakceptowana' : 'Oferta odrzucona'
    });

  } catch (error: any) {
    console.error('❌ RESPOND BID ERROR:', error.message);

    return NextResponse.json(
      { error: 'Błąd serwera podczas przetwarzania reakcji.' },
      { status: 500 }
    );
  }
}
