import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { decryptSession } from '@/lib/sessionUtils';
import { prisma } from '@/lib/prisma';

/** Id zalogowanego użytkownika z cookie sesji lub Bearer JWT (WWW + Deal Room). */
export async function getAuthedUserIdFromRequest(req?: Request): Promise<number | null> {
  const cookieStore = await cookies();
  let authToken =
    cookieStore.get('deal_token')?.value ||
    cookieStore.get('estateos_session')?.value ||
    cookieStore.get('luxestate_user')?.value;

  if (!authToken && req) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) authToken = authHeader.slice('Bearer '.length).trim();
  }

  if (authToken?.startsWith('Bearer ')) {
    authToken = authToken.slice('Bearer '.length).trim();
  }

  const secretRaw = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || '';
  if (authToken && secretRaw) {
    try {
      const verified = await jwtVerify(authToken, new TextEncoder().encode(secretRaw));
      const id = Number(verified.payload.id || verified.payload.sub);
      if (Number.isFinite(id) && id > 0) return id;
    } catch {
      /* legacy session below */
    }
  }

  if (!authToken) return null;

  try {
    const session = decryptSession(authToken) as { id?: number | string; email?: string } | null;
    const id = Number(session?.id);
    if (Number.isFinite(id) && id > 0) return id;
    if (session?.email) {
      const user = await prisma.user.findFirst({
        where: { email: String(session.email) },
        select: { id: true },
      });
      if (user?.id) return Number(user.id);
    }
  } catch {
    const raw = Number(authToken);
    if (Number.isFinite(raw) && raw > 0) return raw;
  }

  return null;
}
