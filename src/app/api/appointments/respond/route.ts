import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

async function handlePingPong(req: Request) {
  try {
    const body = await req.json();
    const id = body.id || body.appointmentId;
    const status = body.status;
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

    const appointment = await prisma.appointment.findUnique({ where: { id: String(id) } });
    if (!appointment) return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 });

    let finalDate = appointment.proposedDate;
    if (incomingDate) {
      const parsed = new Date(incomingDate);
      if (!isNaN(parsed.getTime())) finalDate = parsed;
    }

    const updatedAppt = await prisma.appointment.update({
      where: { id: String(id) },
      data: {
        status: status || appointment.status,
        proposedDate: finalDate,
        message: message !== undefined ? String(message) : appointment.message
      }
    });

    const isBuyer = String(appointment.buyerId) === String(dbUserId) || appointment.buyerId === currentUserEmail;
    const targetUserId = isBuyer ? appointment.sellerId : appointment.buyerId;

    let notifTitle = ''; let notifMsg = '';

    if (status === 'ACCEPTED') { notifTitle = 'Termin Zatwierdzony!'; notifMsg = `Druga strona zaakceptowała spotkanie.`; } 
    else if (status === 'COUNTER') { notifTitle = 'Nowa propozycja terminu'; notifMsg = `Druga strona zaproponowała alternatywny termin.`; } 
    // KRYTYCZNA POPRAWKA: Przekazanie powodu odrzucenia
    else if (status === 'DECLINED') { notifTitle = 'Spotkanie odrzucone'; notifMsg = message ? `Powód: ${message}` : 'Druga strona zrezygnowała z propozycji.'; } 
    else if (status === 'CANCELED') { notifTitle = 'Prezentacja Odwołana!'; notifMsg = `Powód: ${message}`; } 
    else if (status === 'COMPLETED') {
      notifTitle = 'Prezentacja Zakończona'; notifMsg = 'Druga strona potwierdziła spotkanie.';
      if (body.rating && targetUserId) {
        await prisma.review.create({ data: { reviewerId: Number(dbUserId), targetId: Number(targetUserId), rating: Number(body.rating), comment: body.reviewComment || '' } });
      }
    }

    if (notifTitle && targetUserId) {
      await prisma.notification.create({
        data: { userId: Number(targetUserId), title: notifTitle, message: notifMsg, type: 'APPOINTMENT', link: `/moje-konto/crm?appId=${updatedAppt.id}` }
      });
    }

    return NextResponse.json({ success: true, appointment: updatedAppt });
  } catch (error: any) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
export async function POST(req: Request) { return handlePingPong(req); }
export async function PUT(req: Request) { return handlePingPong(req); }
