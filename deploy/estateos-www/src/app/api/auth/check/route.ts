import { decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { MOBILE_USER_SELECT, shapeMobileUser } from '@/lib/mobileUserShape';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session =
      cookieStore.get('estateos_session')?.value || cookieStore.get('luxestate_user')?.value || '';
    
    if (!session) return NextResponse.json({ success: true, loggedIn: false, user: null });

    const parsedSession = decryptSession(session) as { id?: number | string; email?: string } | null;
    const userIdFromToken = Number(parsedSession?.id);
    const emailFromToken = String(parsedSession?.email || '').trim().toLowerCase();

    const user = Number.isFinite(userIdFromToken) && userIdFromToken > 0
      ? await prisma.user.findUnique({ where: { id: userIdFromToken }, select: MOBILE_USER_SELECT })
      : emailFromToken
        ? await prisma.user.findUnique({ where: { email: emailFromToken }, select: MOBILE_USER_SELECT })
        : null;

    if (!user) return NextResponse.json({ success: true, loggedIn: false, user: null });
    const shaped = shapeMobileUser(user);
    return NextResponse.json({
      success: true,
      loggedIn: true, 
      user: {
        ...shaped,
        advertiserType: user.planType === 'AGENCY' ? 'agency' : 'private',
      },
    });
  } catch {
    return NextResponse.json({ success: false, loggedIn: false, user: null, message: 'Błąd sprawdzenia sesji' }, { status: 500 });
  }
}
