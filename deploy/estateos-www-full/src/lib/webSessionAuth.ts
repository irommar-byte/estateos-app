import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/jwtMobile';

function parseUserIdFromPayload(payload: unknown): number | null {
  const p = payload as Record<string, unknown> | null;
  if (!p) return null;
  const id = Number(p.id ?? p.userId ?? p.sub);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function resolveUserIdFromBearer(req: Request): number | null {
  const auth =
    req.headers.get('authorization') ||
    req.headers.get('Authorization') ||
    req.headers.get('x-access-token') ||
    req.headers.get('auth-token');
  const raw = String(auth || '').trim();
  if (!raw) return null;
  const token = raw.startsWith('Bearer ') ? raw.slice('Bearer '.length).trim() : raw;
  if (!token) return null;
  const verified = verifyMobileToken(token);
  if (verified) return parseUserIdFromPayload(verified);
  return null;
}

/** Sesja cookie (WWW) lub Bearer JWT (apka / API). */
export async function resolveWebUserId(req?: Request): Promise<number | null> {
  if (req) {
    const fromBearer = resolveUserIdFromBearer(req);
    if (fromBearer) return fromBearer;
  }

  const cookieStore = await cookies();
  const rawSession =
    cookieStore.get('estateos_session')?.value || cookieStore.get('luxestate_user')?.value || '';
  if (!rawSession) return null;

  try {
    const parsed = decryptSession(rawSession) as { id?: number | string; email?: string } | null;
    const sessionId = Number(parsed?.id);
    if (Number.isFinite(sessionId) && sessionId > 0) return sessionId;

    const email = String(parsed?.email || '').trim().toLowerCase();
    if (email) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (user?.id) return user.id;
    }
  } catch {
    // legacy plain email cookie
  }

  const raw = String(rawSession).trim();
  if (raw.includes('@')) {
    const user = await prisma.user.findUnique({
      where: { email: raw.toLowerCase() },
      select: { id: true },
    });
    if (user?.id) return user.id;
  }

  return null;
}
