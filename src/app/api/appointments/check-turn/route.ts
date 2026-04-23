import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const appId = url.searchParams.get('appId');
    if (!appId) return NextResponse.json({ isMyTurn: true }); // Fallback

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('luxestate_user') || cookieStore.get('estateos_session');
    if (!sessionCookie) return NextResponse.json({ isMyTurn: false });

    let sessionData: any = {};
    try { sessionData = decryptSession(sessionCookie.value); } catch(e) {}
    
    const currentUserEmail = sessionData.email || sessionCookie.value;
    let dbUserId = sessionData.id;

    if (currentUserEmail && String(currentUserEmail).includes('@')) {
       const u = await prisma.user.findFirst({ where: { email: String(currentUserEmail) } });
       if (u) dbUserId = u.id;
    }
    const currentUserId = String(dbUserId || currentUserEmail);

    const appointment = await prisma.appointment.findUnique({ where: { id: appId } });
    if (!appointment) return NextResponse.json({ isMyTurn: false });

    // Jeśli status to nie negocjacje (np. ZATWIERDZONE), zawsze pozwalamy wyświetlić okno
    if (!['PROPOSED', 'COUNTER'].includes(appointment.status)) {
        return NextResponse.json({ isMyTurn: true });
    }

    // LOGIKA 1: Nowa propozycja to ZAWSZE ruch po stronie Sprzedającego
    if (appointment.status === 'PROPOSED') {
        const isMyTurn = (Number(currentUserId) === appointment.sellerId);
        return NextResponse.json({ isMyTurn });
    }

    // LOGIKA 2: Negocjacje. Szukamy kto dostał ostatnie powiadomienie
    const lastNotif = await prisma.notification.findFirst({
        where: { type: 'APPOINTMENT', link: { contains: appId } },
        orderBy: { createdAt: 'desc' }
    });

    if (lastNotif) {
        // Jeśli powiadomienie było do mnie -> TO MOJA TURA
        const isMyTurn = (String(lastNotif.userId) === currentUserId);
        return NextResponse.json({ isMyTurn });
    }

    // Jeśli brak danych, odblokowujemy przyciski awaryjnie
    return NextResponse.json({ isMyTurn: true });
  } catch (error) {
    return NextResponse.json({ isMyTurn: true });
  }
}
