import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptSession } from '@/lib/sessionUtils';
import { prisma } from '@/lib/prisma';
import { loadUserFromEstateosSessionPayload } from '@/lib/loadUserFromEstateosSession';

export const runtime = 'nodejs';

/**
 * Profil dla UI (nav, eksperci): użytkownik + skrót ofert właściciela.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get('estateos_session')?.value;
    if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = decryptSession(raw);
    const user = await loadUserFromEstateosSessionPayload(session);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const offers = await prisma.offer.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 80,
      select: {
        id: true,
        title: true,
        district: true,
        price: true,
        status: true,
      },
    });

    const proExpiresAt = user.proExpiresAt ? new Date(user.proExpiresAt) : null;
    const isProActive = Boolean(
      user.role === 'ADMIN' || (user.isPro && (!proExpiresAt || proExpiresAt.getTime() > Date.now())),
    );

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      image: user.image,
      role: user.role,
      planType: user.planType,
      isPro: isProActive,
      proExpiresAt: user.proExpiresAt,
      offers,
    });
  } catch (e) {
    console.error('GET /api/user/profile', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
