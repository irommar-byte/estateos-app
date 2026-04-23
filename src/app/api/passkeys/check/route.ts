import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('estateos_session')?.value;
        if (!sessionCookie) return NextResponse.json({ hasPasskey: false });

        const session = decryptSession(sessionCookie);
        if (!session?.email) return NextResponse.json({ hasPasskey: false });

        const user = await prisma.user.findUnique({ where: { email: session.email } });
        if (!user) return NextResponse.json({ hasPasskey: false });

        const count = await prisma.authenticator.count({
            where: { userId: user.id }
        });

        return NextResponse.json({ hasPasskey: count > 0 });
    } catch (error) {
        return NextResponse.json({ hasPasskey: false });
    }
}
