import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { notificationService } from '@/lib/services/notification.service';
import { verifyMobileToken } from '@/lib/jwtMobile';

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
    const { action, message } = body;

    const safeMessage =
      typeof message === 'string'
        ? message.trim().slice(0, 500)
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
        content = `[SYSTEM_APPOINTMENT_ACCEPTED:${appointmentId}] Termin zaakceptowany ✅${safeMessage ? ` | ${safeMessage}` : ''}`;
        notifTitle = '✅ Termin zaakceptowany';
        notifBody = 'Spotkanie zostało potwierdzone.';
      }

      if (action === 'DECLINE') {
        content = `[SYSTEM_APPOINTMENT_DECLINED:${appointmentId}] Termin odrzucony ❌${safeMessage ? ` | ${safeMessage}` : ''}`;
        notifTitle = '❌ Termin odrzucony';
        notifBody = 'Twoja propozycja została odrzucona.';
      }

      if (action === 'RESCHEDULE') {
        content = `[SYSTEM_APPOINTMENT_RESCHEDULED:${appointmentId}] Prośba o zmianę terminu 🔄${safeMessage ? ` | ${safeMessage}` : ''}`;
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
        data: {
          targetType: 'DEAL',
          targetId: String(dealId),
          dealId: String(dealId),
          kind: `appointment_${String(action).toLowerCase()}`
        }
      });
    } catch (pushError) {
      console.warn('[WEB APPOINTMENT PUSH WARN]', pushError);
    }

    return NextResponse.json({
      success: true,
      message: `Akcja wykonana: ${action}`
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
