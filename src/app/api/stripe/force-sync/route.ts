import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const { plan } = await req.json();
    if (!plan) return NextResponse.json({ error: 'Brak planu' });

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('estateos_session');
    if (!sessionCookie) return NextResponse.json({ error: 'Brak sesji' });

    const sessionData = decryptSession(sessionCookie.value);
    const email = sessionData?.email || null;
    if (!email) {
      return NextResponse.json({ error: 'Nieprawidłowa sesja' }, { status: 401 });
    }

    if (plan !== 'pakiet_plus') {
      const planType = plan === 'agency' ? 'AGENCY' : 'PRO';
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);
      
      // Twardy zapis do bazy danych - wymuszenie PRO!
      await prisma.user.updateMany({
        where: { email },
        data: { isPro: true, planType, proExpiresAt: expires }
      });
      console.log(`🔥 FORCE-SYNC: Użytkownik ${email} otrzymał wymuszone PRO (${planType})`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
