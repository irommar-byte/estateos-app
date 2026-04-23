import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('estateos_session') || cookieStore.get('luxestate_user');

    let dbUserId = null;
    if (sessionCookie) {
      try {
        dbUserId = decryptSession(sessionCookie.value).id;
      } catch (e) {
        const u = await prisma.user.findUnique({ where: { email: sessionCookie.value } });
        if (u) dbUserId = u.id;
      }
    }

    if (!dbUserId) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

    const offerId = Number(resolvedParams.id);
    const offer = await prisma.offer.findUnique({ where: { id: offerId } });

    if (!offer || offer.userId !== dbUserId) {
      return NextResponse.json({ error: 'Brak dostępu do tej oferty' }, { status: 403 });
    }

    // Przesuwamy czas w przeszłość i nadajemy status archiwum
    await prisma.offer.update({
      where: { id: offerId },
      data: {
        status: 'ARCHIVED',
        expiresAt: new Date(Date.now() - 1000)
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
