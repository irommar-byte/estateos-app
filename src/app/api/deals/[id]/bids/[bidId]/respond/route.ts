import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { notificationService } from '@/lib/services/notification.service';
import { verifyMobileToken } from '@/lib/jwtMobile';

const EVENT_PREFIX = '[[DEAL_EVENT]]';

function buildEventContent(payload: Record<string, unknown>) {
  return `${EVENT_PREFIX}${JSON.stringify(payload)}`;
}

function buildDealroomPushData(dealId: number, offerId: number) {
  return {
    target: 'dealroom',
    notificationType: 'dealroom_chat',
    targetType: 'DEAL',
    dealId,
    offerId,
    title: `Dealroom #${dealId}`,
    deeplink: `estateos://dealroom/${dealId}`,
    screen: 'DealroomChat',
    route: 'DealroomChat',
    entity: 'dealroom',
  };
}

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

    const { action, counterAmount, message, note } = await req.json(); // 'ACCEPT' | 'REJECT' | 'COUNTER'
    const safeNote =
      typeof message === 'string'
        ? message.trim().slice(0, 500)
        : typeof note === 'string'
          ? note.trim().slice(0, 500)
          : null;

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

        // C. Oferta SOLD + anulowanie konkurencyjnych deali — dopiero w POST …/finalize (drugi krok właściciela),
        // żeby akceptacja ceny przez kupującego nie zamykała rynku przed finalną decyzją właściciela.

        // D. SYSTEM MESSAGE (canonical DEAL_EVENT)
        await tx.dealMessage.create({
          data: {
            dealId,
            senderId: userId,
            content: buildEventContent({
              entity: 'BID',
              action: 'ACCEPTED',
              status: 'ACCEPTED',
              bidId,
              amount: bid.amount,
              note: safeNote,
              message: safeNote,
              createdAt: new Date().toISOString(),
            })
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
            content: buildEventContent({
              entity: 'BID',
              action: 'REJECTED',
              status: 'REJECTED',
              bidId,
              amount: bid.amount,
              note: safeNote,
              message: safeNote,
              createdAt: new Date().toISOString(),
            })
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
            content: buildEventContent({
              entity: 'BID',
              action: 'COUNTERED',
              status: 'PENDING',
              bidId,
              amount: numericCounter,
              note: safeNote,
              message: safeNote,
              createdAt: new Date().toISOString(),
            })
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
        data: buildDealroomPushData(dealId, deal.offerId)
      });
    } catch (pushError) {
      console.warn('[WEB BID PUSH WARN]', pushError);
    }

    const freshDeal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, status: true, acceptedBidId: true, isActive: true, offerId: true },
    });

    return NextResponse.json({
      success: true,
      message: action === 'ACCEPT' ? 'Oferta zaakceptowana' : action === 'REJECT' ? 'Oferta odrzucona' : 'Kontroferta wysłana',
      deal: freshDeal
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
