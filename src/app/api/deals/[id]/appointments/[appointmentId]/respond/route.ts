import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { notificationService } from '@/lib/services/notification.service';
import { verifyMobileToken } from '@/lib/jwtMobile';
import {
  buildAppointmentUpdateEmailHtml,
  sendTransactionalEmail,
} from '@/lib/email/transactional';

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

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string; appointmentId: string }> }
) {
  try {
    const { id, appointmentId: rawAppointmentId } = await context.params;
    const dealId = Number(id);
    const appointmentId = Number(rawAppointmentId);

    if (!dealId || isNaN(dealId) || !appointmentId || isNaN(appointmentId)) {
      return NextResponse.json({ error: 'Nieprawidłowe ID' }, { status: 400 });
    }

    const userId = getUserIdFromToken(req.headers.get('authorization'));

    if (!userId) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const body = await req.json();
    const { action, message, note } = body;

    const safeMessage =
      typeof message === 'string'
        ? message.trim().slice(0, 500)
        : typeof note === 'string'
          ? note.trim().slice(0, 500)
          : null;

    const actionMap: Record<string, 'ACCEPTED' | 'DECLINED' | 'RESCHEDULED'> = {
      ACCEPT: 'ACCEPTED',
      DECLINE: 'DECLINED',
      RESCHEDULE: 'RESCHEDULED'
    };

    if (!actionMap[action]) {
      return NextResponse.json({ error: 'Nieznana akcja' }, { status: 400 });
    }

    // 🔍 DATA CHECK
    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });

    if (!deal || !appointment || appointment.dealId !== dealId) {
      return NextResponse.json({ error: 'Nie znaleziono danych' }, { status: 404 });
    }

    if (deal.buyerId !== userId && deal.sellerId !== userId) {
      return NextResponse.json({ error: 'Brak dostępu' }, { status: 403 });
    }

    // ❗ BLOKADY SYSTEMOWE
    if (!deal.isActive || ['FINALIZED', 'CANCELLED'].includes(deal.status)) {
      return NextResponse.json({ error: 'Transakcja zamknięta' }, { status: 400 });
    }

    if (appointment.proposedById === userId) {
      return NextResponse.json({ error: 'Nie możesz reagować na własną propozycję' }, { status: 403 });
    }

    const senderOfProposal = appointment.proposedById;

    await prisma.$transaction(async (tx) => {

      // 🔒 ATOMIC LOCK
      const updated = await tx.appointment.updateMany({
        where: {
          id: appointmentId,
          status: 'PENDING'
        },
        data: {
          status: actionMap[action],
        }
      });

      if (updated.count === 0) {
        throw new Error('APPOINTMENT_ALREADY_HANDLED');
      }

      let content = '';
      let notifTitle = '';
      let notifBody = '';

      if (action === 'ACCEPT') {
        content = buildEventContent({
          entity: 'APPOINTMENT',
          action: 'ACCEPTED',
          status: 'ACCEPTED',
          appointmentId,
          proposedDate: appointment.proposedDate.toISOString(),
          note: safeMessage,
          message: safeMessage,
          createdAt: new Date().toISOString(),
        });
        notifTitle = '✅ Termin zaakceptowany';
        notifBody = 'Spotkanie zostało potwierdzone.';
      }

      if (action === 'DECLINE') {
        content = buildEventContent({
          entity: 'APPOINTMENT',
          action: 'DECLINED',
          status: 'DECLINED',
          appointmentId,
          proposedDate: appointment.proposedDate.toISOString(),
          note: safeMessage,
          message: safeMessage,
          createdAt: new Date().toISOString(),
        });
        notifTitle = '❌ Termin odrzucony';
        notifBody = 'Twoja propozycja została odrzucona.';
      }

      if (action === 'RESCHEDULE') {
        content = buildEventContent({
          entity: 'APPOINTMENT',
          action: 'COUNTERED',
          status: 'PENDING',
          appointmentId,
          proposedDate: appointment.proposedDate.toISOString(),
          note: safeMessage,
          message: safeMessage,
          createdAt: new Date().toISOString(),
        });
        notifTitle = '🔄 Zmiana terminu';
        notifBody = 'Poproszono o nowy termin spotkania.';
      }

      // 💬 TIMELINE
      await tx.dealMessage.create({
        data: {
          dealId,
          senderId: userId,
          content
        }
      });

      // 🔔 NOTIFICATION
      await tx.notification.create({
        data: {
          userId: senderOfProposal,
          type: 'APPOINTMENT',
          title: notifTitle,
          body: notifBody,
          targetType: 'DEAL',
          targetId: String(dealId),
        }
      });

      // 🔄 bump deal
      await tx.deal.update({
        where: { id: dealId },
        data: { updatedAt: new Date() }
      });

    });

    const pushTitle =
      action === 'ACCEPT'
        ? 'Termin zostal zaakceptowany'
        : action === 'DECLINE'
          ? 'Termin zostal odrzucony'
          : 'Zmiana terminu';
    const pushBody =
      action === 'ACCEPT'
        ? 'Spotkanie zostalo potwierdzone.'
        : action === 'DECLINE'
          ? 'Twoja propozycja zostala odrzucona.'
          : 'Poproszono o nowy termin spotkania.';
    try {
      await notificationService.sendPushToUser(senderOfProposal, {
        title: pushTitle,
        body: pushBody,
        data: buildDealroomPushData(dealId, deal.offerId)
      });
    } catch (pushError) {
      console.warn('[WEB APPOINTMENT PUSH WARN]', pushError);
    }

    const dealWithUsers = await prisma.deal.findUnique({
      where: { id: dealId },
      select: {
        id: true,
        buyer: { select: { email: true, name: true } },
        seller: { select: { email: true, name: true } },
        offer: { select: { title: true } },
      },
    });

    if (dealWithUsers) {
      const statusLabel =
        action === 'ACCEPT'
          ? 'Potwierdzony'
          : action === 'DECLINE'
            ? 'Odrzucony'
            : 'Prośba o zmianę terminu';
      const note = safeMessage || '';
      const emails = [
        {
          to: dealWithUsers.buyer?.email || '',
          recipientName: dealWithUsers.buyer?.name || '',
          otherParty: dealWithUsers.seller?.name || '',
        },
        {
          to: dealWithUsers.seller?.email || '',
          recipientName: dealWithUsers.seller?.name || '',
          otherParty: dealWithUsers.buyer?.name || '',
        },
      ].filter((entry) => entry.to);

      await Promise.all(
        emails.map((entry) =>
          sendTransactionalEmail({
            to: entry.to,
            subject: `Aktualizacja terminu prezentacji: ${statusLabel}`,
            html: buildAppointmentUpdateEmailHtml({
              recipientName: entry.recipientName,
              otherPartyName: entry.otherParty,
              offerTitle: dealWithUsers.offer?.title,
              proposedDate: appointment.proposedDate,
              statusLabel,
              note,
              dealId,
            }),
          })
        )
      );
    }

    const freshDeal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, status: true, acceptedBidId: true, isActive: true, offerId: true },
    });

    return NextResponse.json({
      success: true,
      message: `Akcja wykonana: ${action}`,
      deal: freshDeal
    });

  } catch (error: any) {
    if (error.message === 'APPOINTMENT_ALREADY_HANDLED') {
      return NextResponse.json({
        error: 'Ta propozycja została już rozpatrzona'
      }, { status: 400 });
    }

    console.error('❌ RESPOND APPOINTMENT ERROR:', error.message);

    return NextResponse.json({
      error: 'Błąd serwera'
    }, { status: 500 });
  }
}
