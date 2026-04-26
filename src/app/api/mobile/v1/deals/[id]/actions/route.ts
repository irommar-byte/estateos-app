import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

type BidDecision = 'ACCEPT' | 'REJECT' | 'COUNTER';
type AppointmentDecision = 'ACCEPT' | 'DECLINE' | 'COUNTER';

const EVENT_PREFIX = '[[DEAL_EVENT]]';

function parseUserIdFromAuthHeader(authHeader: string | null): number | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const rawToken = authHeader.slice('Bearer '.length).trim();
  const token = rawToken.startsWith('Bearer ') ? rawToken.slice('Bearer '.length).trim() : rawToken;
  if (!token) return null;

  let decoded: any = null;
  const secret = process.env.JWT_SECRET;
  if (secret) {
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      // fallback for legacy tokens to preserve compatibility
      decoded = jwt.decode(token);
    }
  } else {
    decoded = jwt.decode(token);
  }
  const id = Number(decoded?.id ?? decoded?.userId ?? decoded?.sub);
  return Number.isFinite(id) ? id : null;
}

function buildEventContent(payload: Record<string, unknown>) {
  return `${EVENT_PREFIX}${JSON.stringify(payload)}`;
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
    if (!deal.isActive && type !== 'BID_PROPOSE' && type !== 'APPOINTMENT_PROPOSE') {
      return NextResponse.json({ error: 'Transakcja jest zamknieta' }, { status: 400 });
    }

    if (type === 'BID_PROPOSE') {
      const amount = Number(body?.amount);
      const financingRaw = String(body?.financing || 'CASH').toUpperCase();
      const financing = financingRaw === 'CREDIT' ? 'CREDIT' : 'CASH';
      const note = typeof body?.message === 'string' ? body.message.trim().slice(0, 500) : null;

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

      const receiverId = deal.buyerId === actorId ? deal.sellerId : deal.buyerId;
      await prisma.notification.create({
        data: {
          userId: receiverId,
          title: 'Nowa propozycja ceny',
          body: `Nowa oferta: ${amount.toLocaleString('pl-PL')} PLN`,
          type: 'BID_RECEIVED',
          targetType: 'DEAL',
          targetId: String(dealId),
        },
      });

      await prisma.deal.update({ where: { id: dealId }, data: { status: 'NEGOTIATION', isActive: true } });

      return NextResponse.json({ success: true, bidId: bid.id });
    }

    if (type === 'BID_RESPOND') {
      const bidId = Number(body?.bidId);
      const decision = String(body?.decision || '').toUpperCase() as BidDecision;
      const counterAmount = Number(body?.counterAmount);
      const note = typeof body?.message === 'string' ? body.message.trim().slice(0, 500) : null;

      if (!bidId || Number.isNaN(bidId)) {
        return NextResponse.json({ error: 'Brak bidId' }, { status: 400 });
      }
      if (!['ACCEPT', 'REJECT', 'COUNTER'].includes(decision)) {
        return NextResponse.json({ error: 'Nieznana decyzja BID' }, { status: 400 });
      }

      const bid = await prisma.bid.findUnique({ where: { id: bidId } });
      if (!bid || bid.dealId !== dealId) {
        return NextResponse.json({ error: 'Oferta nie istnieje' }, { status: 404 });
      }
      if (bid.senderId === actorId) {
        return NextResponse.json({ error: 'Nie mozesz odpowiedziec na swoja oferte' }, { status: 403 });
      }

      const senderOfOriginalBid = bid.senderId;

      if (decision === 'ACCEPT') {
        await prisma.$transaction(async (tx) => {
          await tx.bid.update({ where: { id: bidId }, data: { status: 'ACCEPTED' } });
          await tx.bid.updateMany({ where: { dealId, id: { not: bidId }, status: { in: ['PENDING', 'COUNTER_OFFER'] } }, data: { status: 'REJECTED' } });
          await tx.deal.update({
            where: { id: dealId },
            data: { acceptedBidId: bidId, status: 'AGREED', isActive: false },
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
          await tx.notification.create({
            data: {
              userId: senderOfOriginalBid,
              title: 'Twoja oferta zostala zaakceptowana',
              body: `${bid.amount.toLocaleString('pl-PL')} PLN`,
              type: 'BID_RECEIVED',
              targetType: 'DEAL',
              targetId: String(dealId),
            },
          });
        });
        return NextResponse.json({ success: true, status: 'ACCEPTED' });
      }

      if (decision === 'REJECT') {
        await prisma.$transaction(async (tx) => {
          await tx.bid.update({ where: { id: bidId }, data: { status: 'REJECTED' } });
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
          await tx.notification.create({
            data: {
              userId: senderOfOriginalBid,
              title: 'Twoja oferta zostala odrzucona',
              body: `${bid.amount.toLocaleString('pl-PL')} PLN`,
              type: 'BID_RECEIVED',
              targetType: 'DEAL',
              targetId: String(dealId),
            },
          });
        });
        return NextResponse.json({ success: true, status: 'REJECTED' });
      }

      if (!counterAmount || Number.isNaN(counterAmount) || counterAmount <= 0) {
        return NextResponse.json({ error: 'Podaj poprawna kontrofertę' }, { status: 400 });
      }

      const counterBid = await prisma.$transaction(async (tx) => {
        await tx.bid.update({ where: { id: bidId }, data: { status: 'COUNTER_OFFER' } });
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
        await tx.notification.create({
          data: {
            userId: senderOfOriginalBid,
            title: 'Nowa kontroferta ceny',
            body: `${counterAmount.toLocaleString('pl-PL')} PLN`,
            type: 'BID_RECEIVED',
            targetType: 'DEAL',
            targetId: String(dealId),
          },
        });
        return created;
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

      const receiverId = deal.buyerId === actorId ? deal.sellerId : deal.buyerId;
      await prisma.notification.create({
        data: {
          userId: receiverId,
          title: 'Nowa propozycja terminu',
          body: proposedDate.toLocaleString('pl-PL'),
          type: 'APPOINTMENT',
          targetType: 'DEAL',
          targetId: String(dealId),
        },
      });

      await prisma.deal.update({ where: { id: dealId }, data: { status: 'NEGOTIATION', isActive: true } });

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

      const senderOfOriginalAppointment = appointment.proposedById;
      if (decision === 'ACCEPT') {
        await prisma.$transaction(async (tx) => {
          await tx.appointment.update({ where: { id: appointmentId }, data: { status: 'ACCEPTED' } });
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
          await tx.notification.create({
            data: {
              userId: senderOfOriginalAppointment,
              title: 'Termin zostal zaakceptowany',
              body: appointment.proposedDate.toLocaleString('pl-PL'),
              type: 'APPOINTMENT',
              targetType: 'DEAL',
              targetId: String(dealId),
            },
          });
        });
        return NextResponse.json({ success: true, status: 'ACCEPTED' });
      }

      if (decision === 'DECLINE') {
        await prisma.$transaction(async (tx) => {
          await tx.appointment.update({ where: { id: appointmentId }, data: { status: 'DECLINED' } });
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
          await tx.notification.create({
            data: {
              userId: senderOfOriginalAppointment,
              title: 'Termin zostal odrzucony',
              body: appointment.proposedDate.toLocaleString('pl-PL'),
              type: 'APPOINTMENT',
              targetType: 'DEAL',
              targetId: String(dealId),
            },
          });
        });
        return NextResponse.json({ success: true, status: 'DECLINED' });
      }

      const counterDate = new Date(counterDateRaw);
      if (Number.isNaN(counterDate.getTime())) {
        return NextResponse.json({ error: 'Nieprawidlowa kontroferta terminu' }, { status: 400 });
      }

      const counterAppointment = await prisma.$transaction(async (tx) => {
        await tx.appointment.update({ where: { id: appointmentId }, data: { status: 'RESCHEDULED' } });
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
        await tx.notification.create({
          data: {
            userId: senderOfOriginalAppointment,
            title: 'Nowa kontroferta terminu',
            body: counterDate.toLocaleString('pl-PL'),
            type: 'APPOINTMENT',
            targetType: 'DEAL',
            targetId: String(dealId),
          },
        });
        return created;
      });

      return NextResponse.json({ success: true, appointmentId: counterAppointment.id, status: 'PENDING' });
    }

    return NextResponse.json({ error: 'Nieobslugiwany typ akcji' }, { status: 400 });
  } catch (error) {
    console.error('MOBILE DEAL ACTIONS ERROR:', error);
    return NextResponse.json({ error: 'Blad serwera' }, { status: 500 });
  }
}
