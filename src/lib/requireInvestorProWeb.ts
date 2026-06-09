import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeIsProActive } from '@/lib/mobileUserShape';
import { resolveWebUserId } from '@/lib/webSessionAuth';

export async function requireInvestorProWeb(req?: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, message: 'Zaloguj się, aby kontynuować.' }, { status: 401 }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isPro: true, proExpiresAt: true },
  });
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, message: 'Nie znaleziono użytkownika.' }, { status: 401 }),
    };
  }

  const isProActive = computeIsProActive({
    role: user.role,
    isPro: user.isPro,
    proExpiresAt: user.proExpiresAt,
  });
  if (!isProActive) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, message: 'Funkcja dostępna wyłącznie dla aktywnego Investor Pro.' },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, userId: user.id, user };
}
