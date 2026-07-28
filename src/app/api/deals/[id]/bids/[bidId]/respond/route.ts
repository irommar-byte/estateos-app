import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notificationService } from '@/lib/services/notification.service';
import { dispatchFavoritesDealProposalPush } from '@/lib/favoritesPricePush';
import { finalizeDealWithOfferArchive } from '@/lib/dealFinalize';
import { resolveDealUserId } from '@/lib/dealRequestAuth';
import {
  FINALIZED_DEAL_STATUSES,
  isPriceNegotiationFrozen,
  resolveBidForResponse,
} from '@/lib/dealBidNegotiation';

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

    const userId = await resolveDealUserId(req);

    if (!userId) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const { action, counterAmount, message, note, intent } = await req.json();
    const safeNote =
      typeof message === 'string'
        ? message.trim().slice(0, 500)
        : typeof note === 'string'
          ? note.trim().slice(0, 500)
          : null;

    if (action !== 'ACCEPT' && action !== 'REJECT' && action !== 'COUNTER') {
      return NextResponse.json({ error: 'Nieznana akcja' }, { status: 400 });
    }

    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { offer: true },
    });

    if (!deal) {
      return NextResponse.json({ error: 'Nie znaleziono danych' }, { status: 404 });
    }

    if (deal.buyerId !== userId && deal.sellerId !== userId) {
      return NextResponse.json({ error: 'Brak dostępu do tego pokoju' }, { status: 403 });
    }

    if (FINALIZED_DEAL_STATUSES.has(String(deal.status || '').toUpperCase())) {
      return NextResponse.json({ error: 'Transakcja jest zamknięta' }, { status: 400 });
    }

    const sellerFinalAcceptFlow =
      action === 'ACCEPT' &&
      userId === deal.sellerId &&
      deal.status === 'AGREED' &&
      Number(deal.acceptedBidId || 0) > 0;

    if (!sellerFinalAcceptFlow && isPriceNegotiationFrozen(deal) && action !== 'REJECT') {
      return NextResponse.json(
        {
          error:
            'Cena została już uzgodniona. Właściciel może jeszcze sfinalizować sprzedaż w Deal Room.',
        },
        { status: 409 }
      );
    }

    let bid;
    try {
      bid = await resolveBidForResponse(prisma, dealId, userId, bidId, deal);
    } catch (resolveErr: unknown) {
      const code = resolveErr instanceof Error ? resolveErr.message : '';
      if (code === 'OWN_BID_PENDING') {
        return NextResponse.json(
          {
            error:
              'Twoja ostatnia propozycja czeka na odpowiedź drugiej strony. Nie możesz wysłać kolejnej kontroferty.',
          },
          { status: 409 }
        );
      }
      if (code === 'BID_ALREADY_HANDLED') {
        return NextResponse.json({ error: 'Ta propozycja została już rozpatrzona' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Brak aktywnej oferty do której można odpowiedzieć' }, { status: 404 });
    }

    const resolvedBidId = bid.id;
    const senderOfBid = bid.senderId;

    if (!sellerFinalAcceptFlow && bid.status !== 'PENDING') {
      return NextResponse.json({ error: 'Ta oferta została już rozpatrzona' }, { status: 409 });
    }

    // ================================
    // 🔥 TRANSAKCJA
    // ================================
    await prisma.$transaction(async (tx) => {

      if (action === 'ACCEPT') {

        // A. Akceptacja, atomicznie tylko dla nadal oczekującej propozycji.
        if (sellerFinalAcceptFlow) {
          await finalizeDealWithOfferArchive(tx, {
            dealId,
            offerId: deal.offerId,
            sellerId: deal.sellerId,
            buyerId: deal.buyerId,
            actorUserId: userId,
            acceptedBidId: resolvedBidId,
            finalPrice: bid.amount,
          });
          await tx.dealMessage.create({
            data: {
              dealId,
              senderId: userId,
              content: buildEventContent({
                entity: 'BID',
                action: 'FINALIZED',
                status: 'FINALIZED',
                bidId: resolvedBidId,
                amount: bid.amount,
                note: safeNote,
                message: safeNote,
                createdAt: new Date().toISOString(),
              }),
            },
          });
        } else {
          const updatedBid = await tx.bid.updateMany({
            where: { id: resolvedBidId, dealId, status: 'PENDING' },
            data: { status: 'ACCEPTED' },
          });
          if (updatedBid.count === 0) {
            throw new Error('BID_ALREADY_HANDLED');
          }

          await tx.bid.updateMany({
            where: {
              dealId,
              id: { not: resolvedBidId },
              status: { in: ['PENDING', 'COUNTER_OFFER'] },
            },
            data: { status: 'REJECTED' },
          });

          await tx.deal.update({
            where: { id: dealId },
            data: {
              status: 'AGREED',
              acceptedBidId: resolvedBidId,
              isActive: true,
            },
          });

          await tx.dealMessage.create({
            data: {
              dealId,
              senderId: userId,
              content: buildEventContent({
                entity: 'BID',
                action: 'ACCEPTED',
                status: 'ACCEPTED',
                bidId: resolvedBidId,
                amount: bid.amount,
                note: safeNote,
                message: safeNote,
                createdAt: new Date().toISOString(),
              }),
            },
          });
        }

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
          where: { id: resolvedBidId, dealId, status: 'PENDING' },
          data: { status: 'REJECTED' },
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
              bidId: resolvedBidId,
              amount: bid.amount,
              note: safeNote,
              message: safeNote,
              createdAt: new Date().toISOString(),
            }),
          },
        });

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
          where: { id: resolvedBidId, dealId, status: 'PENDING' },
          data: { status: 'COUNTER_OFFER' },
        });
        if (updatedBid.count === 0) {
          throw new Error('BID_ALREADY_HANDLED');
        }

        const created = await tx.bid.create({
          data: {
            dealId,
            senderId: userId,
            amount: numericCounter,
            message: safeNote || 'Kontroferta',
            status: 'PENDING',
          },
        });

        const counterIntent =
          typeof intent === 'string' && intent.trim()
            ? intent.trim().slice(0, 64)
            : null;
        await tx.dealMessage.create({
          data: {
            dealId,
            senderId: userId,
            content: buildEventContent({
              entity: 'BID',
              action: 'COUNTERED',
              status: 'PENDING',
              bidId: created.id,
              parentBidId: resolvedBidId,
              amount: created.amount,
              note: safeNote,
              message: safeNote,
              ...(counterIntent ? { intent: counterIntent } : {}),
              createdAt: new Date().toISOString(),
            }),
          },
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

    if (action === 'COUNTER' || action === 'ACCEPT') {
      void dispatchFavoritesDealProposalPush({
        offerId: Number(deal.offerId),
        dealId,
        actorUserId: Number(userId) || null,
        kind: 'bid',
        source: 'deals_bids_respond',
      });
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
