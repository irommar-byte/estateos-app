import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const { offerId, agencyId } = await req.json();
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('luxestate_user') || cookieStore.get('estateos_session');
    
    if (!sessionCookie) return NextResponse.json({ error: 'Musisz być zalogowany' }, { status: 401 });
    let sessionData: any = {}; try { sessionData = decryptSession(sessionCookie.value); } catch(e) {}
    const ownerId = sessionData.id || sessionCookie.value;

    const lead = await prisma.leadTransfer.create({
      data: { offerId: Number(offerId), ownerId: Number(ownerId), agencyId: Number(agencyId) }
    });

    await prisma.notification.create({
      data: {
        userId: Number(agencyId),
        title: '💎 Nowy Gorący Lead (Concierge)',
        message: `Zapytanie Concierge: Prywatny inwestor prosi o wycenę i przejęcie oferty. Zaproponuj swoją prowizję w panelu CRM.`,
        type: 'SYSTEM', link: `/moje-konto/crm`
      }
    });

    return NextResponse.json({ success: true, lead });
  } catch(e) { return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 }); }
}
