import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { notificationService } from '@/lib/services/notification.service';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { Prisma } from '@prisma/client';
import { finalizeDealWithOfferArchive } from '@/lib/dealFinalize';
import { resolveBidForResponse } from '@/lib/dealBidNegotiation';

type BidDecision = 'ACCEPT' | 'REJECT' | 'COUNTER';
type AppointmentDecision = 'ACCEPT' | 'DECLINE' | 'COUNTER';

const EVENT_PREFIX = '[[DEAL_EVENT]]';

function parseUserIdFromAuthHeader(authHeader: string | null): number | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const rawToken = authHeader.slice('Bearer '.length).trim();
  const token = rawToken.startsWith('Bearer ') ? rawToken.slice('Bearer '.length).trim() : rawToken;
  if (!token) return null;

  const verified = verifyMobileToken(token) as any;
  const verifiedId = Number(verified?.id ?? verified?.userId ?? verified?.sub);
  if (Number.isFinite(verifiedId) && verifiedId > 0) {
    return verifiedId;
  }

  // fallback for legacy tokens to preserve compatibility
  const decoded = jwt.decode(token) as any;
  const id = Number(decoded?.id ?? decoded?.userId ?? decoded?.sub);
  return Number.isFinite(id) && id > 0 ? id : null;
}

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

async function notifyNegotiationEvent(params: {
  recipientUserId: number;
  dealId: number;
  offerId: number;
  title: string;
  body: string;
  eventId: string;
  type: 'BID_RECEIVED' | 'APPOINTMENT';
}) {
  const { recipientUserId, dealId, offerId, title, body, eventId, type } = params;
  const idempotencyKey = `deal_event:${eventId}`;

  try {
    await prisma.notification.create({
      data: {
        userId: recipientUserId,
        idempotencyKey,
        title,
        body,
        type,
        targetType: 'DEAL',
        targetId: String(dealId),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return { deduplicated: true as const };
    }
    throw error;
  }

  try {
    await notificationService.sendPushToUser(recipientUserId, {
      title,
      body,
      sound: 'default',
      priority: 'high',
      data: buildDealroomPushData(dealId, offerId),
    });
  } catch (pushError) {
    console.warn('[ACTIONS PUSH WARN][NEGOTIATION_EVENT]', pushError);
  }

  return { deduplicated: false as const };
}

export async function POST(req: Request) {
  try {
    const match = req.url.match(/\/deals\/(\d+)\/actions/);
    if (!match) return NextResponse.json({ error: 'Bad URL' }, { status: 400 });
    const dealId = Number(match[1]);
    if (!dealId || Number.isNaN(dealId)) {
      return NextResponse.json({ error: 'Nieprawidlowe ID transakcji' }, { status: 400 });
    }

    const actorId = parseUserIdFromAuthHeader(req.headers.get('authorization'));
    if (!actorId) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

    const body = await req.json();
    const type = String(body?.type || '');

    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) return NextResponse.json({ error: 'Transakcja nie istnieje' }, { status: 404 });
    if (deal.buyerId !== actorId && deal.sellerId !== actorId) {
      return NextResponse.json({ error: 'Brak dostepu do transakcji' }, { status: 403 });
    }
    if (
      !deal.isActive &&
      type !== 'BID_PROPOSE' &&
      type !== 'APPOINTMENT_PROPOSE' &&
      type !== 'DEAL_FINALIZE'
    ) {
      return NextResponse.json({ error: 'Transakcja jest zamknieta' }, { status: 400 });
    }

    if (type === 'DEAL_FINALIZE') {
      if (actorId !== deal.sellerId) {
        return NextResponse.json({ error: 'Tylko wlasciciel moze sfinalizowac transakcje' }, { status: 403 });
      }
      if (deal.status !== 'AGREED' || !deal.acceptedBidId) {
        return NextResponse.json(
          { error: 'Transakcja musi miec zaakceptowana cene przed finalizacja' },
          { status: 400 }
        );
      }

      const acceptedBid = await prisma.bid.findUnique({
        where: { id: deal.acceptedBidId },
        select: { id: true, amount: true },
      });
      if (!acceptedBid) {
        return NextResponse.json({ error: 'Brak zaakceptowanej oferty ceny' }, { status: 400 });
      }

      try {
        await prisma.$transaction(async (tx) => {
          await finalizeDealWithOfferArchive(tx, {
            dealId,
            offerId: deal.offerId,
            sellerId: deal.sellerId,
            buyerId: deal.buyerId,
            actorUserId: actorId,
            acceptedBidId: acceptedBid.id,
            finalPrice: acceptedBid.amount,
          });
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'DEAL_ALREADY_FINALIZED') {
          return NextResponse.json({ error: 'Transakcja zostala juz sfinalizowana' }, { status: 409 });
        }
        throw error;
      }

      return NextResponse.json({
        deal: {
          id: dealId,
          status: 'FINALIZED',
          offerId: deal.offerId,
          finalPrice: acceptedBid.amount,
          finalizedAt: new Date().toISOString(),
        },
        offer: {
          id: deal.offerId,
          status: 'SOLD',
        },
        publication: {
          status: 'ENDED',
          endReason: 'SOLD',
        },
      });
    }

    if (type === 'BID_PROPOSE') {
      const amount = Number(body?.amount);
      const financingRaw = String(body?.financing || 'CASH').toUpperCase();
      const financing = financingRaw === 'CREDIT' ? 'CREDIT' : 'CASH';
      const note = typeof body?.message === 'string'
        ? body.message.trim().slice(0, 500)
        : typeof body?.note === 'string'
          ? body.note.trim().slice(0, 500)
          : null;

      if (!amount || Number.isNaN(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Podaj poprawna kwote' }, { status: 400 });
      }

      const bid = await prisma.bid.create({
        data: {
          dealId,
          senderId: actorId,
          amount,
          message: note || (financing === 'CASH' ? 'Finansowanie: GOTOWKA' : 'Finansowanie: KREDYT'),
          status: 'PENDING',
        },
      });

      const eventContent = buildEventContent({
        entity: 'BID',
        action: 'PROPOSED',
        bidId: bid.id,
        amount: bid.amount,
        financing,
        note,
        status: bid.status,
        createdAt: bid.createdAt.toISOString(),
      });

      await prisma.dealMessage.create({
        data: { dealId, senderId: actorId, content: eventContent, isRead: false },
      });
      await prisma.deal.update({ where: { id: dealId }, data: { status: 'NEGOTIATION', isActive: true } });

      const receiverId = deal.buyerId === actorId ? deal.sellerId : deal.buyerId;
      await notifyNegotiationEvent({
        recipientUserId: receiverId,
        dealId,
        offerId: deal.offerId,
        title: 'Nowa propozycja ceny',
        body: `Nowa oferta: ${amount.toLocaleString('pl-PL')} PLN`,
        eventId: `deal:${dealId}:bid:${bid.id}:PROPOSED`,
        type: 'BID_RECEIVED',
      });

      return NextResponse.json({ success: true, bidId: bid.id });
    }

    if (type === 'BID_RESPOND') {
      const requestedBidId = Number(body?.bidId);
      const decision = String(body?.decision || '').toUpperCase() as BidDecision;
      const counterAmount = Number(body?.counterAmount);
      const note = typeof body?.message === 'string'
        ? body.message.trim().slice(0, 500)
        : typeof body?.note === 'string'
          ? body.note.trim().slice(0, 500)
          : null;

      if (!['ACCEPT', 'REJECT', 'COUNTER'].includes(decision)) {
        return NextResponse.json({ error: 'Nieznana decyzja BID' }, { status: 400 });
      }

      let bid;
      try {
        bid = await resolveBidForResponse(
          prisma,
          dealId,
          actorId,
          requestedBidId && !Number.isNaN(requestedBidId) ? requestedBidId : null
        );
      } catch (resolveErr: any) {
        const code = String(resolveErr?.message || '');
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
        return NextResponse.json(
          { error: 'Brak aktywnej oferty do której można odpowiedzieć' },
          { status: 404 }
        );
      }

      const bidId = bid.id;
      const sellerFinalAcceptFlow =
        decision === 'ACCEPT' &&
        actorId === deal.sellerId &&
        deal.status === 'AGREED' &&
        Number(deal.acceptedBidId || 0) === bidId;
      if (!sellerFinalAcceptFlow && bid.status !== 'PENDING') {
        return NextResponse.json({ error: 'Ta propozycja zostala juz rozpatrzona' }, { status: 409 });
      }

      const senderOfOriginalBid = bid.senderId;

      if (decision === 'ACCEPT') {
        if (sellerFinalAcceptFlow) {
          const finalized = await prisma.$transaction(async (tx) => {
            const latestDeal = await tx.deal.findUnique({
              where: { id: dealId },
              select: { status: true, acceptedBidId: true },
            });
            if (
              !latestDeal ||
              latestDeal.status !== 'AGREED' ||
              Number(latestDeal.acceptedBidId || 0) !== bidId
            ) {
              throw new Error('DEAL_NOT_READY_FOR_FINALIZATION');
            }

            const summary = await finalizeDealWithOfferArchive(tx, {
              dealId,
              offerId: deal.offerId,
              sellerId: deal.sellerId,
              buyerId: deal.buyerId,
              actorUserId: actorId,
              acceptedBidId: bidId,
              finalPrice: bid.amount,
            });
            await tx.dealMessage.create({
              data: {
                dealId,
                senderId: actorId,
                content: buildEventContent({
                  entity: 'BID',
                  action: 'FINALIZED',
                  bidId,
                  amount: bid.amount,
                  note,
                  status: 'FINALIZED',
                  createdAt: new Date().toISOString(),
                }),
              },
            });
            return summary;
          });

          await prisma.deal.update({ where: { id: dealId }, data: { updatedAt: new Date() } });
          await notifyNegotiationEvent({
            recipientUserId: senderOfOriginalBid,
            dealId,
            offerId: deal.offerId,
            title: 'Transakcja zostala sfinalizowana',
            body: `${bid.amount.toLocaleString('pl-PL')} PLN`,
            eventId: `deal:${dealId}:bid:${bidId}:FINALIZED`,
            type: 'BID_RECEIVED',
          });
          return NextResponse.json({
            deal: {
              id: dealId,
              status: 'FINALIZED',
              offerId: deal.offerId,
              finalPrice: bid.amount,
              finalizedAt: new Date().toISOString(),
            },
            offer: {
              id: deal.offerId,
              status: 'SOLD',
            },
            publication: {
              status: finalized.publicationStatus,
              endReason: finalized.publicationEndReason,
            },
          });
        }

        const accepted = await prisma.$transaction(async (tx) => {
          const updatedBid = await tx.bid.updateMany({
            where: { id: bidId, dealId, status: 'PENDING' },
            data: { status: 'ACCEPTED' },
          });
          if (updatedBid.count === 0) return false;

          await tx.bid.updateMany({
            where: { dealId, id: { not: bidId }, status: { in: ['PENDING', 'COUNTER_OFFER'] } },
            data: { status: 'REJECTED' },
          });

          await tx.deal.update({
            where: { id: dealId },
            data: { acceptedBidId: bidId, status: 'AGREED', isActive: true },
          });

          await tx.dealMessage.create({
            data: {
              dealId,
              senderId: actorId,
              content: buildEventContent({
                entity: 'BID',
                action: 'ACCEPTED',
                bidId,
                amount: bid.amount,
                note,
                status: 'ACCEPTED',
                createdAt: new Date().toISOString(),
              }),
            },
          });
          return true;
        });
        if (!accepted) {
          return NextResponse.json({ error: 'Ta propozycja zostala juz rozpatrzona' }, { status: 409 });
        }
        await prisma.deal.update({ where: { id: dealId }, data: { updatedAt: new Date() } });
        await notifyNegotiationEvent({
          recipientUserId: senderOfOriginalBid,
          dealId,
          offerId: deal.offerId,
          title: 'Twoja oferta zostala zaakceptowana',
          body: `${bid.amount.toLocaleString('pl-PL')} PLN`,
          eventId: `deal:${dealId}:bid:${bidId}:ACCEPTED`,
          type: 'BID_RECEIVED',
        });
        return NextResponse.json({
          success: true,
          status: 'ACCEPTED',
          finalized: false,
          offerId: deal.offerId,
          finalPrice: bid.amount,
        });
      }

      if (decision === 'REJECT') {
        const rejected = await prisma.$transaction(async (tx) => {
          const updatedBid = await tx.bid.updateMany({
            where: { id: bidId, dealId, status: 'PENDING' },
            data: { status: 'REJECTED' }
          });
          if (updatedBid.count === 0) return false;

          await tx.dealMessage.create({
            data: {
              dealId,
              senderId: actorId,
              content: buildEventContent({
                entity: 'BID',
                action: 'REJECTED',
                bidId,
                amount: bid.amount,
                note,
                status: 'REJECTED',
                createdAt: new Date().toISOString(),
              }),
            },
          });
          return true;
        });
        if (!rejected) {
          return NextResponse.json({ error: 'Ta propozycja zostala juz rozpatrzona' }, { status: 409 });
        }
        await prisma.deal.update({ where: { id: dealId }, data: { updatedAt: new Date() } });
        await notifyNegotiationEvent({
          recipientUserId: senderOfOriginalBid,
          dealId,
          offerId: deal.offerId,
          title: 'Twoja oferta zostala odrzucona',
          body: `${bid.amount.toLocaleString('pl-PL')} PLN`,
          eventId: `deal:${dealId}:bid:${bidId}:REJECTED`,
          type: 'BID_RECEIVED',
        });
        return NextResponse.json({ success: true, status: 'REJECTED' });
      }

      if (!counterAmount || Number.isNaN(counterAmount) || counterAmount <= 0) {
        return NextResponse.json({ error: 'Podaj poprawna kontrofertę' }, { status: 400 });
      }

      const counterBid = await prisma.$transaction(async (tx) => {
        const updatedBid = await tx.bid.updateMany({
          where: { id: bidId, dealId, status: 'PENDING' },
          data: { status: 'COUNTER_OFFER' }
        });
        if (updatedBid.count === 0) {
          throw new Error('BID_ALREADY_HANDLED');
        }

        const created = await tx.bid.create({
          data: {
            dealId,
            senderId: actorId,
            amount: counterAmount,
            message: note || 'Kontroferta',
            status: 'PENDING',
          },
        });
        await tx.dealMessage.create({
          data: {
            dealId,
            senderId: actorId,
            content: buildEventContent({
              entity: 'BID',
              action: 'COUNTERED',
              bidId: created.id,
              parentBidId: bidId,
              amount: created.amount,
              note,
              status: created.status,
              createdAt: created.createdAt.toISOString(),
            }),
          },
        });
        return created;
      });
      await prisma.deal.update({ where: { id: dealId }, data: { updatedAt: new Date() } });
      await notifyNegotiationEvent({
        recipientUserId: senderOfOriginalBid,
        dealId,
        offerId: deal.offerId,
        title: 'Nowa kontroferta ceny',
        body: `${counterAmount.toLocaleString('pl-PL')} PLN`,
        eventId: `deal:${dealId}:bid:${counterBid.id}:COUNTERED`,
        type: 'BID_RECEIVED',
      });

      return NextResponse.json({ success: true, bidId: counterBid.id, status: 'PENDING' });
    }

    if (type === 'APPOINTMENT_PROPOSE') {
      const proposedDateRaw = String(body?.proposedDate || '');
      const note = typeof body?.message === 'string' ? body.message.trim().slice(0, 500) : null;
      const proposedDate = new Date(proposedDateRaw);
      if (Number.isNaN(proposedDate.getTime())) {
        return NextResponse.json({ error: 'Nieprawidlowy termin' }, { status: 400 });
      }

      const appointment = await prisma.appointment.create({
        data: {
          dealId,
          proposedById: actorId,
          proposedDate,
          message: note,
          status: 'PENDING',
        },
      });

      await prisma.dealMessage.create({
        data: {
          dealId,
          senderId: actorId,
          content: buildEventContent({
            entity: 'APPOINTMENT',
            action: 'PROPOSED',
            appointmentId: appointment.id,
            proposedDate: appointment.proposedDate.toISOString(),
            note,
            status: appointment.status,
            createdAt: appointment.createdAt.toISOString(),
          }),
        },
      });
      await prisma.deal.update({ where: { id: dealId }, data: { status: 'NEGOTIATION', isActive: true } });

      const receiverId = deal.buyerId === actorId ? deal.sellerId : deal.buyerId;
      await notifyNegotiationEvent({
        recipientUserId: receiverId,
        dealId,
        offerId: deal.offerId,
        title: 'Nowa propozycja terminu',
        body: proposedDate.toLocaleString('pl-PL'),
        eventId: `deal:${dealId}:appointment:${appointment.id}:PROPOSED`,
        type: 'APPOINTMENT',
      });

      return NextResponse.json({ success: true, appointmentId: appointment.id });
    }

    if (type === 'APPOINTMENT_RESPOND') {
      const appointmentId = Number(body?.appointmentId);
      const decision = String(body?.decision || '').toUpperCase() as AppointmentDecision;
      const counterDateRaw = String(body?.counterDate || '');
      const note = typeof body?.message === 'string' ? body.message.trim().slice(0, 500) : null;

      if (!appointmentId || Number.isNaN(appointmentId)) {
        return NextResponse.json({ error: 'Brak appointmentId' }, { status: 400 });
      }
      if (!['ACCEPT', 'DECLINE', 'COUNTER'].includes(decision)) {
        return NextResponse.json({ error: 'Nieznana decyzja APPOINTMENT' }, { status: 400 });
      }

      const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
      if (!appointment || appointment.dealId !== dealId) {
        return NextResponse.json({ error: 'Spotkanie nie istnieje' }, { status: 404 });
      }
      if (appointment.proposedById === actorId) {
        return NextResponse.json({ error: 'Nie mozesz odpowiedziec na swoja propozycje' }, { status: 403 });
      }
      if (appointment.status !== 'PENDING') {
        return NextResponse.json({ error: 'Ta propozycja terminu zostala juz rozpatrzona' }, { status: 409 });
      }

      const senderOfOriginalAppointment = appointment.proposedById;
      if (decision === 'ACCEPT') {
        const accepted = await prisma.$transaction(async (tx) => {
          const updatedAppointment = await tx.appointment.updateMany({
            where: { id: appointmentId, dealId, status: 'PENDING' },
            data: { status: 'ACCEPTED' }
          });
          if (updatedAppointment.count === 0) return false;

          await tx.dealMessage.create({
            data: {
              dealId,
              senderId: actorId,
              content: buildEventContent({
                entity: 'APPOINTMENT',
                action: 'ACCEPTED',
                appointmentId,
                proposedDate: appointment.proposedDate.toISOString(),
                note,
                status: 'ACCEPTED',
                createdAt: new Date().toISOString(),
              }),
            },
          });
          return true;
        });
        if (!accepted) {
          return NextResponse.json({ error: 'Ta propozycja terminu zostala juz rozpatrzona' }, { status: 409 });
        }
        await prisma.deal.update({ where: { id: dealId }, data: { updatedAt: new Date() } });
        await notifyNegotiationEvent({
          recipientUserId: senderOfOriginalAppointment,
          dealId,
          offerId: deal.offerId,
          title: 'Termin zostal zaakceptowany',
          body: appointment.proposedDate.toLocaleString('pl-PL'),
          eventId: `deal:${dealId}:appointment:${appointmentId}:ACCEPTED`,
          type: 'APPOINTMENT',
        });
        return NextResponse.json({ success: true, status: 'ACCEPTED' });
      }

      if (decision === 'DECLINE') {
        const declined = await prisma.$transaction(async (tx) => {
          const updatedAppointment = await tx.appointment.updateMany({
            where: { id: appointmentId, dealId, status: 'PENDING' },
            data: { status: 'DECLINED' }
          });
          if (updatedAppointment.count === 0) return false;

          await tx.dealMessage.create({
            data: {
              dealId,
              senderId: actorId,
              content: buildEventContent({
                entity: 'APPOINTMENT',
                action: 'DECLINED',
                appointmentId,
                proposedDate: appointment.proposedDate.toISOString(),
                note,
                status: 'DECLINED',
                createdAt: new Date().toISOString(),
              }),
            },
          });
          return true;
        });
        if (!declined) {
          return NextResponse.json({ error: 'Ta propozycja terminu zostala juz rozpatrzona' }, { status: 409 });
        }
        await prisma.deal.update({ where: { id: dealId }, data: { updatedAt: new Date() } });
        await notifyNegotiationEvent({
          recipientUserId: senderOfOriginalAppointment,
          dealId,
          offerId: deal.offerId,
          title: 'Termin zostal odrzucony',
          body: appointment.proposedDate.toLocaleString('pl-PL'),
          eventId: `deal:${dealId}:appointment:${appointmentId}:REJECTED`,
          type: 'APPOINTMENT',
        });
        return NextResponse.json({ success: true, status: 'DECLINED' });
      }

      const counterDate = new Date(counterDateRaw);
      if (Number.isNaN(counterDate.getTime())) {
        return NextResponse.json({ error: 'Nieprawidlowa kontroferta terminu' }, { status: 400 });
      }

      const counterAppointment = await prisma.$transaction(async (tx) => {
        const updatedAppointment = await tx.appointment.updateMany({
          where: { id: appointmentId, dealId, status: 'PENDING' },
          data: { status: 'RESCHEDULED' }
        });
        if (updatedAppointment.count === 0) {
          throw new Error('APPOINTMENT_ALREADY_HANDLED');
        }

        const created = await tx.appointment.create({
          data: {
            dealId,
            proposedById: actorId,
            proposedDate: counterDate,
            message: note,
            status: 'PENDING',
          },
        });
        await tx.dealMessage.create({
          data: {
            dealId,
            senderId: actorId,
            content: buildEventContent({
              entity: 'APPOINTMENT',
              action: 'COUNTERED',
              appointmentId: created.id,
              parentAppointmentId: appointmentId,
              proposedDate: created.proposedDate.toISOString(),
              note,
              status: created.status,
              createdAt: created.createdAt.toISOString(),
            }),
          },
        });
        return created;
      });
      await prisma.deal.update({ where: { id: dealId }, data: { updatedAt: new Date() } });
      await notifyNegotiationEvent({
        recipientUserId: senderOfOriginalAppointment,
        dealId,
        offerId: deal.offerId,
        title: 'Nowa kontroferta terminu',
        body: counterDate.toLocaleString('pl-PL'),
        eventId: `deal:${dealId}:appointment:${counterAppointment.id}:COUNTERED`,
        type: 'APPOINTMENT',
      });

      return NextResponse.json({ success: true, appointmentId: counterAppointment.id, status: 'PENDING' });
    }

    return NextResponse.json({ error: 'Nieobslugiwany typ akcji' }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === 'BID_ALREADY_HANDLED') {
      return NextResponse.json({ error: 'Ta propozycja zostala juz rozpatrzona' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'APPOINTMENT_ALREADY_HANDLED') {
      return NextResponse.json({ error: 'Ta propozycja terminu zostala juz rozpatrzona' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'DEAL_NOT_READY_FOR_FINALIZATION') {
      return NextResponse.json(
        { error: 'Finalizacja możliwa dopiero po etapie AGREED i acceptedBidId.' },
        { status: 409 }
      );
    }
    console.error('MOBILE DEAL ACTIONS ERROR:', error);
    return NextResponse.json({ error: 'Blad serwera' }, { status: 500 });
  }
}
