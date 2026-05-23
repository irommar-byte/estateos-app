import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { prisma } from '@/lib/prisma';
import { parseUserIdFromBearer } from '@/lib/passkeyMobileAuth';
import { userHasRegisteredPasskey } from '@/lib/mobilePasskeyStatus';

async function resolveUserIdFromCookies(): Promise<number> {
  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get('estateos_session')?.value || cookieStore.get('luxestate_user')?.value || '';
  if (!sessionToken) return 0;

  const session = decryptSession(sessionToken) as { id?: number | string; email?: string } | null;
  let userId = Number(session?.id);
  if (Number.isFinite(userId) && userId > 0) return userId;

  if (session?.email) {
    const fromEmail = await prisma.user.findUnique({
      where: { email: String(session.email).trim().toLowerCase() },
      select: { id: true },
    });
    userId = Number(fromEmail?.id || 0);
  }
  return Number.isFinite(userId) && userId > 0 ? userId : 0;
}

export async function GET(req: Request) {
  try {
    const bearerUserId = parseUserIdFromBearer(req);
    let userId =
      bearerUserId != null && Number.isFinite(bearerUserId) && bearerUserId > 0 ? bearerUserId : 0;

    if (userId <= 0) {
      userId = await resolveUserIdFromCookies();
    }

    if (userId <= 0) {
      return NextResponse.json({ success: false, hasPasskey: false, error: 'Brak sesji' }, { status: 401 });
    }

    const hasPasskey = await userHasRegisteredPasskey(userId);

    return NextResponse.json(
      { success: true, hasPasskey, userId },
      { headers: { 'Cache-Control': 'no-store' } }
    );
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
