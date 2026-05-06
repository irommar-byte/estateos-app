import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { decryptSession } from '@/lib/sessionUtils';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/jwtMobile';

/**
 * Mobile: Bearer JWT (JWT_SECRET). Web: NextAuth lub cookie `estateos_session` / `luxestate_user`.
 */
export async function resolveUploaderUserId(req: Request): Promise<number | null> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const xAccessToken = req.headers.get('x-access-token');
  const tokenCandidate = (authHeader || xAccessToken || '').trim();
  if (tokenCandidate) {
    const token = tokenCandidate
      .replace(/^Bearer\s+/i, '')
      .replace(/^Token\s+/i, '')
      .trim();
    if (token) {
      const payload = verifyMobileToken(token) as Record<string, unknown> | null;
      const raw = payload?.id ?? payload?.sub ?? payload?.userId;
      const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }

  let sessionEmail: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    sessionEmail = session?.user?.email ?? null;
  } catch {
    /* ignore */
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('estateos_session') || cookieStore.get('luxestate_user');
  let userIdFromSession: number | null = null;
  let email = sessionEmail;

  if (sessionCookie?.value) {
    const decrypted = decryptSession(sessionCookie.value);
    if (decrypted?.email) email = String(decrypted.email);

    const rawId = decrypted?.id;
    if (rawId !== undefined && rawId !== null) {
      const n = typeof rawId === 'number' ? rawId : parseInt(String(rawId), 10);
      if (Number.isFinite(n) && n > 0) userIdFromSession = n;
    }
  }

  if (userIdFromSession) return userIdFromSession;

  if (email) {
    const user = await prisma.user.findUnique({
      where: { email: String(email) },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  return null;
}
