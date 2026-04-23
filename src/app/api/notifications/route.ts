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
    
    let dbUserId = sessionData.id;
    const email = sessionData.email || sessionCookie.value;

    if (email && String(email).includes('@')) {
       const u = await prisma.user.findFirst({ where: { email: String(email) } });
       if (u) dbUserId = u.id;
    }

    const finalUserId = String(dbUserId || email);

    const notifications = await prisma.notification.findMany({
      where: { userId: Number(finalUserId) },
      orderBy: { createdAt: 'desc' },
      take: 20 // Pobieramy 20 najnowszych
    });

    return NextResponse.json(notifications);
  } catch (error) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { id } = await req.json();
    await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Błąd' }, { status: 500 });
  }
}


export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('luxestate_user') || cookieStore.get('estateos_session');
    if (!sessionCookie) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    
    let userId = sessionCookie.value;
    try { userId = decryptSession(sessionCookie.value).id || userId; } catch(e){}

    await prisma.notification.updateMany({
      where: { userId: Number(userId), isRead: false },
      data: { isRead: true }
    });

    return NextResponse.json({ success: true });
  } catch(e) {
    return NextResponse.json({ error: 'Błąd aktualizacji' }, { status: 500 });
  }
}