import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

async function handlePingPong(req: Request) {
  try {
    const body = await req.json();
    const id = Number(body.id || body.appointmentId);
    const status = String(body.status || '').toUpperCase();
    const incomingDate = body.newDate || body.date || body.proposedDate;
    const message = body.message;

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
      DECLINED: 'DECLINED',
      COUNTER: 'RESCHEDULED',
      RESCHEDULED: 'RESCHEDULED',
    };
    const nextStatus = statusMap[status];
    if (!nextStatus) return NextResponse.json({ error: 'Nieznany status' }, { status: 400 });

    const updatedAppt = await prisma.appointment.update({
      where: { id },
      data: {
        status: nextStatus,
        proposedDate: finalDate,
        message: message !== undefined ? String(message) : appointment.message
      }
    });

    const actorId = Number(dbUserId);
    const isBuyer = appointment.deal.buyerId === actorId;
    const targetUserId = isBuyer ? appointment.deal.sellerId : appointment.deal.buyerId;

    let notifTitle = ''; let notifMsg = '';

    if (nextStatus === 'ACCEPTED') { notifTitle = 'Termin Zatwierdzony!'; notifMsg = `Druga strona zaakceptowała spotkanie.`; } 
    else if (nextStatus === 'RESCHEDULED') { notifTitle = 'Nowa propozycja terminu'; notifMsg = `Druga strona zaproponowała alternatywny termin.`; } 
    // KRYTYCZNA POPRAWKA: Przekazanie powodu odrzucenia
    else if (nextStatus === 'DECLINED') { notifTitle = 'Spotkanie odrzucone'; notifMsg = message ? `Powód: ${message}` : 'Druga strona zrezygnowała z propozycji.'; } 

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
    }

    return NextResponse.json({ success: true, appointment: updatedAppt });
  } catch (error: any) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
export async function POST(req: Request) { return handlePingPong(req); }
export async function PUT(req: Request) { return handlePingPong(req); }
