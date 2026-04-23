import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('luxestate_user') || cookieStore.get('estateos_session');
    if (!sessionCookie) return NextResponse.json([]);

    let sessionData: any = {};
    try { sessionData = decryptSession(sessionCookie.value); } catch(e) {}
    
    const email = sessionData.email || sessionCookie.value;
    let dbUserId = sessionData.id;

    // KRYTYCZNA POPRAWKA: Tłumaczenie e-maila na twarde ID z bazy danych (aby znaleźć spotkania Sprzedającego)
    if (email && String(email).includes('@')) {
       const user = await prisma.user.findFirst({ where: { email: String(email) } });
       if (user) dbUserId = String(user.id);
    }

    const userIds = [
      email ? String(email) : null,
      dbUserId ? String(dbUserId) : null,
      sessionData.id ? String(sessionData.id) : null
    ].filter(Boolean) as string[];

    const appointments = await prisma.appointment.findMany({
      where: {
        OR: [
          { sellerId: { in: userIds.map(Number) } },
          { buyerId: { in: userIds.map(Number) } }
        ]
      },
      orderBy: { proposedDate: 'asc' }
    });

    return NextResponse.json(appointments);
  } catch (error) {
    console.error("Błąd pobierania kalendarza:", error);
    return NextResponse.json([]);
  }
}
