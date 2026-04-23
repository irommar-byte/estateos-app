import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { prisma } from '@/lib/prisma';

export async function DELETE() {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('estateos_session')?.value;
        if (!sessionCookie) return NextResponse.json({ error: "Brak sesji" }, { status: 401 });

        const session = decryptSession(sessionCookie);
        if (!session?.email) return NextResponse.json({ error: "Błąd sesji" }, { status: 401 });

        const user = await prisma.user.findUnique({ where: { email: session.email } });
        if (!user) return NextResponse.json({ error: "Nie znaleziono użytkownika" }, { status: 404 });

        await prisma.authenticator.deleteMany({
            where: { userId: user.id, providerAccountId: 'passkey' }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Błąd usuwania Passkey:", error);
        return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
    }
}
