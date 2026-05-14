import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken =
      cookieStore.get('estateos_session')?.value || cookieStore.get('luxestate_user')?.value || '';
    if (!sessionToken) {
      return NextResponse.json({ success: false, hasPasskey: false, error: 'Brak sesji' }, { status: 401 });
    }

    const session = decryptSession(sessionToken) as { id?: number | string; email?: string } | null;
    let userId = Number(session?.id);
    if ((!Number.isFinite(userId) || userId <= 0) && session?.email) {
      const fromEmail = await prisma.user.findUnique({
        where: { email: String(session.email).trim().toLowerCase() },
        select: { id: true },
      });
      userId = Number(fromEmail?.id || 0);
    }

    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ success: false, hasPasskey: false, error: 'Nieprawidłowa sesja' }, { status: 401 });
    }

    const passkeyCount = await prisma.authenticator.count({
      where: {
        userId,
      },
    });

    return NextResponse.json({ success: true, hasPasskey: passkeyCount > 0 });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        hasPasskey: false,
        error: error instanceof Error ? error.message : 'Błąd serwera',
      },
      { status: 500 }
    );
  }
}
