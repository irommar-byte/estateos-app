import { decryptSession } from '@/lib/sessionUtils';
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

export async function POST(req: Request) {
  try {
    const { offerId, sellerId, proposedDate, message } = await req.json();

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

    const buyerId = Number(dbUserId);
    const parsedOfferId = Number(offerId);
    if (!buyerId || Number.isNaN(parsedOfferId)) {
      return NextResponse.json({ error: 'Nieprawidłowe dane użytkownika/oferty' }, { status: 400 });
    }

    // Zabezpieczenie przed błędem 500 (Invalid Date)
    const parsedDate = new Date(proposedDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Nieprawidłowy format daty.' }, { status: 400 });
    }

    const offer = await prisma.offer.findUnique({ where: { id: parsedOfferId }, select: { userId: true } });
    if (!offer) return NextResponse.json({ error: 'Nie znaleziono oferty' }, { status: 404 });
    const resolvedSellerId = Number(sellerId) || offer.userId;

    const deal = await prisma.deal.upsert({
      where: { offerId_buyerId: { offerId: parsedOfferId, buyerId } },
      create: { offerId: parsedOfferId, buyerId, sellerId: resolvedSellerId, status: 'NEGOTIATION' },
      update: { status: 'NEGOTIATION', isActive: true, updatedAt: new Date() },
    });

    const existingPending = await prisma.appointment.findFirst({
      where: { dealId: deal.id, proposedById: buyerId, status: 'PENDING' },
    });
    if (existingPending) {
      return NextResponse.json({ error: 'Masz już aktywne zapytanie do tej nieruchomości.' }, { status: 400 });
    }

    const appointment = await prisma.appointment.create({
      data: {
        dealId: deal.id,
        proposedById: buyerId,
        proposedDate: parsedDate,
        message: message ? String(message) : null,
      }
    });
    
    // Canonical DEAL_EVENT (parity app/web)
    try {
        await prisma.dealMessage.create({
            data: {
                dealId: deal.id,
                senderId: buyerId,
                content: buildEventContent({
                  entity: 'APPOINTMENT',
                  action: 'PROPOSED',
                  status: 'PENDING',
                  appointmentId: appointment.id,
                  proposedDate: parsedDate.toISOString(),
                  note: message ? String(message).trim().slice(0, 500) : null,
                  message: message ? String(message).trim().slice(0, 500) : null,
                  createdAt: appointment.createdAt.toISOString(),
                }),
            }
        });
    } catch(e) { console.log('DealMessage err', e); }
    

    await prisma.notification.create({
      data: {
        userId: resolvedSellerId,
        title: 'Nowe zapytanie z Lejka!',
        body: 'Klient chce obejrzeć Twoją nieruchomość.',
        type: 'APPOINTMENT',
        targetType: 'DEAL',
        targetId: String(deal.id),
      }
    });

    try {
      await notificationService.sendPushToUser(resolvedSellerId, {
        title: 'Nowa propozycja terminu',
        body: `${parsedDate.toLocaleDateString('pl-PL')} ${parsedDate.toLocaleTimeString('pl-PL', {hour: '2-digit', minute:'2-digit'})}`,
        data: {
          target: 'dealroom',
          notificationType: 'dealroom_chat',
          targetType: 'DEAL',
          dealId: deal.id,
          offerId: parsedOfferId,
          deeplink: `estateos://dealroom/${deal.id}`,
          screen: 'DealroomChat',
          route: 'DealroomChat',
          entity: 'dealroom',
        },
      });
    } catch (pushError) {
      console.warn('[APPOINTMENT PROPOSE PUSH WARN]', pushError);
    }

    const [buyer, seller, offerMeta] = await Promise.all([
      prisma.user.findUnique({ where: { id: buyerId }, select: { email: true, name: true } }),
      prisma.user.findUnique({ where: { id: resolvedSellerId }, select: { email: true, name: true } }),
      prisma.offer.findUnique({ where: { id: parsedOfferId }, select: { title: true } }),
    ]);

    const statusLabel = 'Nowa propozycja terminu';
    const note = message ? String(message).trim().slice(0, 500) : '';
    await Promise.all(
      [
        buyer?.email
          ? sendTransactionalEmail({
              to: buyer.email,
              subject: `Wysłano ${statusLabel.toLowerCase()}`,
              html: buildAppointmentUpdateEmailHtml({
                recipientName: buyer.name,
                otherPartyName: seller?.name,
                offerTitle: offerMeta?.title,
                proposedDate: parsedDate,
                statusLabel,
                note,
                dealId: deal.id,
              }),
            })
          : Promise.resolve(false),
        seller?.email
          ? sendTransactionalEmail({
              to: seller.email,
              subject: `Aktualizacja prezentacji: ${statusLabel}`,
              html: buildAppointmentUpdateEmailHtml({
                recipientName: seller.name,
                otherPartyName: buyer?.name,
                offerTitle: offerMeta?.title,
                proposedDate: parsedDate,
                statusLabel,
                note,
                dealId: deal.id,
              }),
            })
          : Promise.resolve(false),
      ]
    );

    return NextResponse.json({ success: true, appointment });
  } catch (error) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
