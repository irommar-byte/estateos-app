import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeMobile } from '@/lib/mobileAuth';
import { MOBILE_USER_SELECT, shapeMobileUser } from '@/lib/mobileUserShape';

export async function POST(req: Request) {
  try {
    const auth = await authorizeMobile(req);
    if (!auth.ok) return auth.response;

    const { userId, image } = await req.json();

    const targetUserId = Number(userId);
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      return NextResponse.json({ success: false, message: 'Brak poprawnego ID użytkownika' }, { status: 400 });
    }
    if (targetUserId !== auth.userId) {
      return NextResponse.json({ success: false, message: 'Brak uprawnień do edycji tego profilu' }, { status: 403 });
    }

    if (typeof image !== 'string' || !image.trim()) {
      return NextResponse.json({ success: false, message: 'Brak obrazu avatara' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { image: image.trim() },
      select: MOBILE_USER_SELECT,
    });

    return NextResponse.json({ success: true, user: shapeMobileUser(updated) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Błąd serwera';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
