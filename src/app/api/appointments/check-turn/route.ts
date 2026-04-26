import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const appId = Number(url.searchParams.get('appId'));
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

    const appointment = await prisma.appointment.findUnique({
      where: { id: appId },
      include: { deal: true },
    });
    if (!appointment) return NextResponse.json({ isMyTurn: false });

    // Dla zamkniętych decyzji oba UI mogą pokazać tylko stan końcowy
    if (appointment.status !== 'PENDING') return NextResponse.json({ isMyTurn: false });
    // Ruch ma druga strona niż autor propozycji
    return NextResponse.json({ isMyTurn: Number(currentUserId) !== appointment.proposedById });
  } catch (error) {
    return NextResponse.json({ isMyTurn: true });
  }
}
