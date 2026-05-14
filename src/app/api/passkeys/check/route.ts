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
        if (!sessionCookie) return NextResponse.json({ hasPasskey: false });

        const session = decryptSession(sessionCookie);
        const sessionUserId = Number((session as any)?.id);
        const sessionEmail = String((session as any)?.email || '').trim();

        let userId: number | null = Number.isFinite(sessionUserId) && sessionUserId > 0 ? sessionUserId : null;
        if (!userId && sessionEmail) {
          const user = await prisma.user.findUnique({
            where: { email: sessionEmail },
            select: { id: true }
          });
          userId = user?.id ?? null;
        }
        if (!userId) return NextResponse.json({ hasPasskey: false });

        const count = await prisma.authenticator.count({
            where: { userId }
        });

        return NextResponse.json({ hasPasskey: count > 0 });
    } catch (error) {
        return NextResponse.json({ hasPasskey: false });
    }
}
