import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { notificationService } from '@/lib/services/notification.service';

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
    deeplink: `estateos://dealroom/${dealId}`,
    screen: 'DealroomChat',
    route: 'DealroomChat',
    entity: 'dealroom',
  };
}

function getUserIdFromToken(authHeader: string | null): number | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.split(' ')[1];
    const verified = verifyMobileToken(token) as any;
    const verifiedId = Number(verified?.id || verified?.userId || verified?.sub);
    if (Number.isFinite(verifiedId) && verifiedId > 0) return verifiedId;

    const secret = process.env.JWT_SECRET;
    if (secret) {
      const payload = jwt.verify(token, secret) as any;
      const jwtId = Number(payload?.id || payload?.sub);
      if (Number.isFinite(jwtId) && jwtId > 0) return jwtId;
    }
    const decoded = jwt.decode(token) as any;
    const decodedId = Number(decoded?.id || decoded?.userId || decoded?.sub);
    return Number.isFinite(decodedId) && decodedId > 0 ? decodedId : null;
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const dealId = Number(id);

    if (!dealId || isNaN(dealId)) {
      return NextResponse.json({ error: 'Błędne ID' }, { status: 400 });
    }

    const userId = getUserIdFromToken(req.headers.get('authorization'));

    if (!userId) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const body = await req.json();
    const { proposedDate, message, type } = body;

    const appointmentDate = new Date(proposedDate);

    if (isNaN(appointmentDate.getTime()) || appointmentDate <= new Date()) {
      return NextResponse.json({ error: 'Nieprawidłowa data' }, { status: 400 });
    }

    const safeMessage =
      typeof message === 'string'
        ? message.trim().slice(0, 500)
        : null;

    const validTypes = ['MEETING', 'CALL', 'VIDEO'] as const;
    const safeType = validTypes.includes(type) ? type : 'MEETING';

    const deal = await prisma.deal.findUnique({
      where: { id: dealId }
    });

    if (!deal) {
      return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 });
    }

    if (deal.buyerId !== userId && deal.sellerId !== userId) {
      return NextResponse.json({ error: 'Brak dostępu' }, { status: 403 });
    }

    // ❗ BLOKADA PO FINALIZACJI / ANULOWANIU
    if (['FINALIZED', 'CANCELLED'].includes(deal.status)) {
      return NextResponse.json({
        error: 'Transakcja jest zamknięta'
      }, { status: 400 });
    }

    const receiverId =
      deal.buyerId === userId ? deal.sellerId : deal.buyerId;

    const result = await prisma.$transaction(async (tx) => {

      // 🔒 LIMIT PENDING (atomic)
      const pendingCount = await tx.appointment.count({
        where: { dealId, status: 'PENDING' }
      });

      if (pendingCount >= 2) {
        throw new Error('LIMIT_PENDING_APPOINTMENTS');
      }

      // 🧠 CREATE
      const appointment = await tx.appointment.create({
        data: {
          dealId,
          proposedById: userId,
          proposedDate: appointmentDate,
          message: safeMessage,
          type: safeType
        }
      });

      // 💬 TIMELINE — canonical DEAL_EVENT
      await tx.dealMessage.create({
        data: {
          dealId,
          senderId: userId,
          content: buildEventContent({
            entity: 'APPOINTMENT',
            action: 'PROPOSED',
            status: 'PENDING',
            appointmentId: appointment.id,
            proposedDate: appointment.proposedDate.toISOString(),
            note: safeMessage,
            message: safeMessage,
            type: safeType,
            createdAt: appointment.createdAt.toISOString(),
          })
        }
      });

      // 🔄 bump deal
      await tx.deal.update({
        where: { id: dealId },
        data: { updatedAt: new Date() }
      });

      // 🔔 NOTIFICATION
      await tx.notification.create({
        data: {
          userId: receiverId,
          type: 'APPOINTMENT',
          title: '📅 Nowe spotkanie',
          body: `${appointmentDate.toLocaleString('pl-PL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}`,
          targetType: 'DEAL',
          targetId: String(dealId),
        }
      });

      return appointment;
    });

    try {
      await notificationService.sendPushToUser(receiverId, {
        title: '📅 Nowe spotkanie',
        body: `${appointmentDate.toLocaleString('pl-PL', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`,
        data: buildDealroomPushData(dealId, deal.offerId),
      });
    } catch (pushError) {
      console.warn('[DEAL APPOINTMENT PUSH WARN]', pushError);
    }

    const freshDeal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, status: true, acceptedBidId: true, isActive: true, offerId: true },
    });

    return NextResponse.json({
      success: true,
      appointment: result,
      deal: freshDeal,
    });

  } catch (error: any) {
    if (error.message === 'LIMIT_PENDING_APPOINTMENTS') {
      return NextResponse.json({
        error: 'Za dużo oczekujących spotkań'
      }, { status: 429 });
    }

    console.error('❌ CREATE APPOINTMENT ERROR:', error.message);

    return NextResponse.json({
      error: 'Błąd serwera'
    }, { status: 500 });
  }
}
