import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('luxestate_user') || cookieStore.get('estateos_session');
    if (!sessionCookie) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

    let sessionData: any = {};
    try { sessionData = decryptSession(sessionCookie.value); } catch(e) {}

    let userIdStr = sessionCookie.value;
    if (sessionData && sessionData.id) {
      userIdStr = sessionData.id;
    }

    const userIdNum = Number(userIdStr);
    
    // Zabezpieczenie przed wywaleniem bazy przez NaN
    if (isNaN(userIdNum)) {
       return NextResponse.json([]); 
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: userIdNum },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error("[NOTIFICATIONS GET ERROR]", error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('luxestate_user') || cookieStore.get('estateos_session');
    if (!sessionCookie) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

    let sessionData: any = {};
    try { sessionData = decryptSession(sessionCookie.value); } catch(e) {}

    let userIdStr = sessionCookie.value;
    if (sessionData && sessionData.id) userIdStr = sessionData.id;

    const userIdNum = Number(userIdStr);
    if (isNaN(userIdNum)) return NextResponse.json({ success: false });

    await prisma.notification.updateMany({
      where: { userId: userIdNum, readAt: null },
      data: { readAt: new Date(), status: 'READ' }
    });

    return NextResponse.json({ success: true });
  } catch(e) {
    return NextResponse.json({ error: 'Błąd aktualizacji' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { id } = await req.json().catch(() => ({}));
    if (!id) return NextResponse.json({ error: 'Brak ID' }, { status: 400 });
    
    await prisma.notification.update({
      where: { id },
      data: { readAt: new Date(), status: 'READ' }
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Błąd' }, { status: 500 });
  }
}
