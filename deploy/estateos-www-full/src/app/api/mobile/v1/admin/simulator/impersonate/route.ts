import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { signMobileToken } from '@/lib/jwtMobile';
import { MOBILE_USER_SELECT } from '@/lib/mobileUserShape';
import { shapeMobileUserEntitled } from '@/lib/mobileUserShapeEntitled';
import { userHasRegisteredPasskey } from '@/lib/mobilePasskeyStatus';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  try {
    const body = (await req.json().catch(() => ({}))) as { userId?: unknown };
    const userId = Number(body.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowe ID użytkownika.' }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: MOBILE_USER_SELECT,
    });
    if (!target) {
      return NextResponse.json({ success: false, message: 'Brak konta o tym ID.' }, { status: 404 });
    }

    const token = signMobileToken({
      id: target.id,
      email: target.email,
      role: target.role,
      impersonatedBy: gate.adminId,
    });
    const hasPasskey = await userHasRegisteredPasskey(target.id);

    return NextResponse.json({
      success: true,
      token,
      user: { ...await shapeMobileUserEntitled(target), hasPasskey },
      impersonatedBy: gate.adminId,
    });
  } catch (error) {
    console.error('[admin/simulator/impersonate]', error);
    return NextResponse.json({ success: false, message: 'Nie udało się przejąć sesji.' }, { status: 500 });
  }
}
