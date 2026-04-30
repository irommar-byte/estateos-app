import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { notificationService } from '@/lib/services/notification.service';
import { verifyMobileToken } from '@/lib/jwtMobile';

// ================================
// AUTH HELPER
// ================================
function getUserIdFromToken(authHeader: string | null): number | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.split(' ')[1];
    const verified = verifyMobileToken(token) as any;
    const verifiedId = Number(verified?.id || verified?.userId || verified?.sub);
    if (Number.isFinite(verifiedId) && verifiedId > 0) return verifiedId;

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

    const { action, counterAmount, message } = await req.json(); // 'ACCEPT' | 'REJECT' | 'COUNTER'

    if (action !== 'ACCEPT' && action !== 'REJECT' && action !== 'COUNTER') {
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

        // A. Akceptacja, atomicznie tylko dla nadal oczekującej propozycji.
        const updatedBid = await tx.bid.updateMany({
          where: { id: bidId, dealId, status: { in: ['PENDING', 'COUNTER_OFFER'] } },
          data: { status: 'ACCEPTED' }
        });
        if (updatedBid.count === 0) {
          throw new Error('BID_ALREADY_HANDLED');
        }

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

      } else if (action === 'REJECT') {

        // A. Odrzucenie, atomicznie tylko dla nadal oczekującej propozycji.
        const updatedBid = await tx.bid.updateMany({
          where: { id: bidId, dealId, status: { in: ['PENDING', 'COUNTER_OFFER'] } },
          data: { status: 'REJECTED' }
        });
        if (updatedBid.count === 0) {
          throw new Error('BID_ALREADY_HANDLED');
        }

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

        await tx.deal.update({
          where: { id: dealId },
          data: { updatedAt: new Date() }
        });

      } else {
        const numericCounter = Number(counterAmount);
        if (!Number.isFinite(numericCounter) || numericCounter <= 0) {
          throw new Error('INVALID_COUNTER');
        }

        const updatedBid = await tx.bid.updateMany({
          where: { id: bidId, dealId, status: { in: ['PENDING', 'COUNTER_OFFER'] } },
          data: { status: 'COUNTER_OFFER', amount: numericCounter }
        });
        if (updatedBid.count === 0) {
          throw new Error('BID_ALREADY_HANDLED');
        }

        await tx.dealMessage.create({
          data: {
            dealId,
            senderId: userId,
            content: `[[DEAL_EVENT]]${JSON.stringify({
              entity: 'BID',
              action: 'COUNTERED',
              amount: numericCounter,
              note: typeof message === 'string' ? message.trim().slice(0, 200) : null,
            })}`
          }
        });

        await tx.notification.create({
          data: {
            userId: senderOfBid,
            type: 'BID_RECEIVED',
            title: '🔁 Otrzymałeś kontrofertę',
            body: `Nowa kwota: ${numericCounter.toLocaleString('pl-PL')} PLN`,
            targetType: 'DEAL',
            targetId: String(dealId),
          }
        });

        await tx.deal.update({
          where: { id: dealId },
          data: { updatedAt: new Date() }
        });
      }
    });

    try {
      await notificationService.sendPushToUser(senderOfBid, {
        title: action === 'ACCEPT' ? 'Oferta zaakceptowana' : action === 'REJECT' ? 'Oferta odrzucona' : 'Nowa kontroferta',
        body: action === 'ACCEPT'
          ? `Twoja oferta ${bid.amount} PLN została przyjęta.`
          : action === 'REJECT'
            ? `Twoja oferta ${bid.amount} PLN została odrzucona.`
            : `Nowa kwota: ${Number(counterAmount || 0).toLocaleString('pl-PL')} PLN`,
        data: {
          targetType: 'DEAL',
          targetId: String(dealId),
          dealId: String(dealId),
          kind: action === 'ACCEPT' ? 'bid_accepted' : action === 'REJECT' ? 'bid_rejected' : 'bid_countered'
        }
      });
    } catch (pushError) {
      console.warn('[WEB BID PUSH WARN]', pushError);
    }

    return NextResponse.json({
      success: true,
      message: action === 'ACCEPT' ? 'Oferta zaakceptowana' : action === 'REJECT' ? 'Oferta odrzucona' : 'Kontroferta wysłana'
    });

  } catch (error: any) {
    if (error.message === 'INVALID_COUNTER') {
      return NextResponse.json(
        { error: 'Podaj poprawną kwotę kontroferty' },
        { status: 400 }
      );
    }
    if (error.message === 'BID_ALREADY_HANDLED') {
      return NextResponse.json(
        { error: 'Ta propozycja została już rozpatrzona' },
        { status: 409 }
      );
    }

    console.error('❌ RESPOND BID ERROR:', error.message);

    return NextResponse.json(
      { error: 'Błąd serwera podczas przetwarzania reakcji.' },
      { status: 500 }
    );
  }
}
