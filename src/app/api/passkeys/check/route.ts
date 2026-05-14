import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const sessionCookie =
          cookieStore.get('estateos_session')?.value ||
          cookieStore.get('luxestate_user')?.value;
        if (!sessionCookie) return NextResponse.json({ success: false, hasPasskey: false, error: 'Brak sesji' }, { status: 401 });

        const session = decryptSession(sessionCookie) as { id?: number | string; email?: string } | null;
        const sessionUserId = Number(session?.id);
        const sessionEmail = String(session?.email || '').trim();

        let userId: number | null = Number.isFinite(sessionUserId) && sessionUserId > 0 ? sessionUserId : null;
        if (!userId && sessionEmail) {
          const user = await prisma.user.findUnique({
            where: { email: sessionEmail },
            select: { id: true }
          });
          userId = user?.id ?? null;
        }
        if (!userId) return NextResponse.json({ success: false, hasPasskey: false, error: 'Nieprawidłowa sesja' }, { status: 401 });

        const count = await prisma.authenticator.count({
            where: { userId }
        });

        return NextResponse.json({ success: true, hasPasskey: count > 0 });
    } catch (error) {
        return NextResponse.json(
          { success: false, hasPasskey: false, error: error instanceof Error ? error.message : 'Błąd serwera' },
          { status: 500 }
        );
    }
}
