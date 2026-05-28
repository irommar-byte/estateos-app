import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthedUserIdFromRequest } from '@/lib/sessionAuth';

export async function POST(req: Request) {
  try {
    const userId = await getAuthedUserIdFromRequest(req);
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
