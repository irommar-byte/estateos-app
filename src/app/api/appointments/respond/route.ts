import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { notificationService } from '@/lib/services/notification.service';
import {
  buildAppointmentUpdateEmailHtml,
  sendTransactionalEmail,
} from '@/lib/email/transactional';

export const dynamic = 'force-dynamic';
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

async function handlePingPong(req: Request) {
  try {
    const body = await req.json();
    const id = Number(body.id || body.appointmentId);
    const status = String(body.status || '').toUpperCase();
    const incomingDate = body.newDate || body.date || body.proposedDate;
    const message = body.message ?? body.note;

    if (!id) return NextResponse.json({ error: 'Brak ID spotkania' }, { status: 400 });

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('luxestate_user') || cookieStore.get('estateos_session');
    if (!sessionCookie) return NextResponse.json({ error: 'Brak sesji' }, { status: 401 });

    let sessionData: any = {};
    try { sessionData = decryptSession(sessionCookie.value); } catch(e) {}
    const currentUserEmail = sessionData.email || sessionCookie.value;
    let dbUserId = sessionData.id;

    if (currentUserEmail && String(currentUserEmail).includes('@')) {
       const u = await prisma.user.findFirst({ where: { email: String(currentUserEmail) } });
       if (u) dbUserId = u.id;
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { deal: true },
    });
    if (!appointment) return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 });

    let finalDate = appointment.proposedDate;
    if (incomingDate) {
      const parsed = new Date(incomingDate);
      if (!isNaN(parsed.getTime())) finalDate = parsed;
    }

    const statusMap: Record<string, 'ACCEPTED' | 'DECLINED' | 'RESCHEDULED'> = {
      ACCEPTED: 'ACCEPTED',
      ACCEPT: 'ACCEPTED',
      DECLINED: 'DECLINED',
      DECLINE: 'DECLINED',
      COUNTER: 'RESCHEDULED',
      COUNTERED: 'RESCHEDULED',
      RESCHEDULE: 'RESCHEDULED',
      RESCHEDULED: 'RESCHEDULED',
    };
    const nextStatus = statusMap[status];
    if (!nextStatus) return NextResponse.json({ error: 'Nieznany status' }, { status: 400 });

    const safeNote = message != null ? String(message).trim().slice(0, 500) : null;
    const updatedAppt = await prisma.appointment.update({
      where: { id },
      data: {
        status: nextStatus,
        proposedDate: finalDate,
        message: safeNote !== null ? safeNote : appointment.message
      }
    });

    const actorId = Number(dbUserId);
    const isBuyer = appointment.deal.buyerId === actorId;
    const targetUserId = isBuyer ? appointment.deal.sellerId : appointment.deal.buyerId;

    let notifTitle = ''; let notifMsg = '';
    let eventAction: 'ACCEPTED' | 'DECLINED' | 'COUNTERED' = 'ACCEPTED';
    let eventStatus: 'ACCEPTED' | 'DECLINED' | 'PENDING' = 'ACCEPTED';

    if (nextStatus === 'ACCEPTED') {
      eventAction = 'ACCEPTED';
      eventStatus = 'ACCEPTED';
      notifTitle = 'Termin Zatwierdzony!';
      notifMsg = `Druga strona zaakceptowała spotkanie.`;
    } else if (nextStatus === 'RESCHEDULED') {
      eventAction = 'COUNTERED';
      eventStatus = 'PENDING';
      notifTitle = 'Nowa propozycja terminu';
      notifMsg = `Druga strona zaproponowała alternatywny termin.`;
    } else if (nextStatus === 'DECLINED') {
      eventAction = 'DECLINED';
      eventStatus = 'DECLINED';
      notifTitle = 'Spotkanie odrzucone';
      notifMsg = safeNote ? `Powód: ${safeNote}` : 'Druga strona zrezygnowała z propozycji.';
    }

    await prisma.dealMessage.create({
      data: {
        dealId: appointment.dealId,
        senderId: actorId,
        content: buildEventContent({
          entity: 'APPOINTMENT',
          action: eventAction,
          status: eventStatus,
          appointmentId: appointment.id,
          proposedDate: finalDate.toISOString(),
          note: safeNote,
          message: safeNote,
          createdAt: new Date().toISOString(),
        }),
      },
    });

    await prisma.deal.update({
      where: { id: appointment.dealId },
      data: { updatedAt: new Date() },
    });

    if (notifTitle && targetUserId) {
      await prisma.notification.create({
        data: {
          userId: Number(targetUserId),
          title: notifTitle,
          body: notifMsg,
          type: 'APPOINTMENT',
          targetType: 'DEAL',
          targetId: String(appointment.dealId),
        }
      });
      try {
        await notificationService.sendPushToUser(Number(targetUserId), {
          title: notifTitle,
          body: notifMsg,
          data: buildDealroomPushData(appointment.dealId, appointment.deal.offerId),
        });
      } catch (pushError) {
        console.warn('[APPOINTMENT RESPOND PUSH WARN]', pushError);
      }
    }

    const dealWithUsers = await prisma.deal.findUnique({
      where: { id: appointment.dealId },
      select: {
        id: true,
        buyer: { select: { email: true, name: true } },
        seller: { select: { email: true, name: true } },
        offer: { select: { title: true } },
      },
    });

    if (dealWithUsers) {
      const statusLabel =
        nextStatus === 'ACCEPTED'
          ? 'Potwierdzony'
          : nextStatus === 'DECLINED'
            ? 'Odrzucony'
            : 'Prośba o zmianę terminu';
      const note = safeNote || '';
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
              proposedDate: finalDate,
              statusLabel,
              note,
              dealId: appointment.dealId,
            }),
          })
        )
      );
    }

    const freshDeal = await prisma.deal.findUnique({
      where: { id: appointment.dealId },
      select: { id: true, status: true, acceptedBidId: true, isActive: true, offerId: true },
    });
    return NextResponse.json({ success: true, appointment: updatedAppt, deal: freshDeal });
  } catch (error: any) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
export async function POST(req: Request) { return handlePingPong(req); }
export async function PUT(req: Request) { return handlePingPong(req); }
