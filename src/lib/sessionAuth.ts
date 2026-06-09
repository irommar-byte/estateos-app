import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { decryptSession, resolveSessionSecret } from '@/lib/sessionUtils';
import { prisma } from '@/lib/prisma';

async function userIdFromEncryptedSession(token: string): Promise<number | null> {
  try {
    const session = decryptSession(token) as { id?: number | string; email?: string } | null;
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
    /* try next token */
  }
  return null;
}

async function userIdFromJwt(token: string): Promise<number | null> {
  const raw = token.startsWith('Bearer ') ? token.slice('Bearer '.length).trim() : token.trim();
  if (!raw) return null;

  let secret: string;
  try {
    secret = resolveSessionSecret();
  } catch {
    return null;
  }

  try {
    const verified = await jwtVerify(raw, new TextEncoder().encode(secret));
    const id = Number(verified.payload.id || verified.payload.sub || verified.payload.userId);
    if (Number.isFinite(id) && id > 0) return id;
  } catch {
    /* try next token */
  }
  return null;
}

/** Id zalogowanego użytkownika z cookie sesji lub Bearer JWT (WWW + Deal Room). */
export async function getAuthedUserIdFromRequest(req?: Request): Promise<number | null> {
  if (req) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const bearer = authHeader.slice('Bearer '.length).trim();
      const fromBearerJwt = await userIdFromJwt(bearer);
      if (fromBearerJwt) return fromBearerJwt;
      const fromBearerSession = await userIdFromEncryptedSession(bearer);
      if (fromBearerSession) return fromBearerSession;
    }
  }

  const cookieStore = await cookies();
  /** Najpierw ciastka sesji WWW (jak `/api/user/profile`), potem JWT deal room. */
  const cookieTokens = [
    cookieStore.get('estateos_session')?.value,
    cookieStore.get('luxestate_user')?.value,
    cookieStore.get('deal_token')?.value,
  ].filter((value): value is string => Boolean(value));

  for (const token of cookieTokens) {
    const fromSession = await userIdFromEncryptedSession(token);
    if (fromSession) return fromSession;
  }

  for (const token of cookieTokens) {
    const fromJwt = await userIdFromJwt(token);
    if (fromJwt) return fromJwt;
  }

  return null;
}
