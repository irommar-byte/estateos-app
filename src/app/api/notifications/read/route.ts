import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { notificationId, notificationIds } = body;

    // Odznacz całą przekazaną listę (Zaznacz wszystkie)
    if (notificationIds && Array.isArray(notificationIds)) {
      await prisma.notification.updateMany({
        where: { id: { in: notificationIds } },
        data: { isRead: true }
      });
    } 
    // Odznacz tylko jedno
    else if (notificationId) {
      await prisma.notification.update({
        where: { id: String(notificationId) },
        data: { isRead: true }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
