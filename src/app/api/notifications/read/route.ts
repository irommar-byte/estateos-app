import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';

async function getAuthedUserIdFromSession(): Promise<number | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('luxestate_user') || cookieStore.get('estateos_session');
  if (!sessionCookie) return null;

  try {
    const sessionData = decryptSession(sessionCookie.value) as { id?: number | string } | null;
    const id = Number(sessionData?.id);
    if (Number.isFinite(id) && id > 0) return id;
  } catch {
    // ignore and fallback below
  }

  const raw = Number(sessionCookie.value);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

export async function POST(req: Request) {
  try {
    const userId = await getAuthedUserIdFromSession();
    if (!userId) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const body = await req.json();
    const { notificationId, notificationIds } = body;

    // Odznacz całą przekazaną listę (Zaznacz wszystkie)
    if (notificationIds && Array.isArray(notificationIds)) {
      await prisma.notification.updateMany({
        where: { id: { in: notificationIds }, userId },
        data: { readAt: new Date(), status: 'READ' }
      });
    } 
    // Odznacz tylko jedno
    else if (notificationId) {
      await prisma.notification.updateMany({
        where: { id: String(notificationId), userId },
        data: { readAt: new Date(), status: 'READ' }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
