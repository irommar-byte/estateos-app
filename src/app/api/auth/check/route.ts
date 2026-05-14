import { decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { loadUserFromEstateosSessionPayload } from '@/lib/loadUserFromEstateosSession';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('estateos_session');

    if (!session) return NextResponse.json({ loggedIn: false });

    const parsedSession = decryptSession(session.value);
    if (!parsedSession) return NextResponse.json({ loggedIn: false });

    const user = await loadUserFromEstateosSessionPayload(parsedSession);
    if (!user) return NextResponse.json({ loggedIn: false });

    const proExpiresAt = user.proExpiresAt ? new Date(user.proExpiresAt) : null;
    const isProActive = Boolean(
      user.role === 'ADMIN' || (user.isPro && (!proExpiresAt || proExpiresAt.getTime() > Date.now())),
    );

    return NextResponse.json({
      loggedIn: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        image: user.image,
        advertiserType: user.planType === 'AGENCY' ? 'agency' : 'private',
        role: user.role,
        isPro: isProActive,
        planType: user.planType,
        proExpiresAt: user.proExpiresAt,
      },
    });
  } catch {
    return NextResponse.json({ loggedIn: false });
  }
}
