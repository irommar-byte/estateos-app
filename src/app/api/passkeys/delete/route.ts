import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { prisma } from '@/lib/prisma';

export async function DELETE(req: Request) {
    try {
        const cookieStore = await cookies();
        const sessionCookie =
          cookieStore.get('estateos_session')?.value ||
          cookieStore.get('luxestate_user')?.value;
        if (!sessionCookie) return NextResponse.json({ error: "Brak sesji" }, { status: 401 });

        const session = decryptSession(sessionCookie);
        const sessionUserId = Number((session as any)?.id);
        const sessionEmail = String((session as any)?.email || '').trim();

        let userId: number | null = Number.isFinite(sessionUserId) && sessionUserId > 0 ? sessionUserId : null;
        if (!userId && sessionEmail) {
          const user = await prisma.user.findUnique({ where: { email: sessionEmail }, select: { id: true } });
          userId = user?.id ?? null;
        }
        if (!userId) return NextResponse.json({ error: "Nie znaleziono użytkownika" }, { status: 404 });

        const url = new URL(req.url);
        const credentialIdFromQuery = String(url.searchParams.get('credentialId') || '').trim();
        const credentialIdFromHeader = String(
          req.headers.get('x-passkey-credential-id') || req.headers.get('x-credential-id') || ''
        ).trim();
        const credentialId = credentialIdFromQuery || credentialIdFromHeader;

        if (!credentialId) {
          return NextResponse.json({
            success: false,
            error: "Podaj credentialId konkretnego klucza. Masowe usuwanie wszystkich kluczy jest zablokowane.",
          }, { status: 400 });
        }

        const deleted = await prisma.authenticator.deleteMany({
          where: { userId, credentialID: credentialId }
        });
        if (deleted.count === 0) {
          return NextResponse.json({ success: false, error: "Nie znaleziono klucza dla tego urządzenia" }, { status: 404 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Błąd usuwania Passkey:", error);
        return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
    }
}
