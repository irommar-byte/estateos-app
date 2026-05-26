import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import jwt from 'jsonwebtoken';
import { decryptSession } from '@/lib/sessionUtils';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { prisma } from '@/lib/prisma';

/** Użytkownik dealroomu: Bearer (app) lub ciasteczka sesji (WWW CRM). */
export async function resolveDealUserId(req: Request): Promise<number | null> {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const verified = verifyMobileToken(token) as { id?: number; userId?: number; sub?: number };
      const verifiedId = Number(verified?.id || verified?.userId || verified?.sub);
      if (Number.isFinite(verifiedId) && verifiedId > 0) return verifiedId;
    } catch {
      // continue
    }
    const secret = process.env.JWT_SECRET;
    if (secret && token) {
      try {
        const payload = jwt.verify(token, secret) as { id?: number; sub?: number };
        const jwtId = Number(payload?.id || payload?.sub);
        if (Number.isFinite(jwtId) && jwtId > 0) return jwtId;
      } catch {
        // continue
      }
    }
  }

  const cookieStore = await cookies();
  const dealToken = cookieStore.get('deal_token')?.value;
  const sessionToken =
    cookieStore.get('estateos_session')?.value || cookieStore.get('luxestate_user')?.value;
  const token = dealToken || sessionToken;
  const secretRaw = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || '';

  if (token && secretRaw) {
    try {
      const secret = new TextEncoder().encode(secretRaw);
      const { payload } = await jwtVerify(token, secret);
      const id = Number(payload.id || payload.sub);
      if (Number.isFinite(id) && id > 0) return id;
    } catch {
      // continue
    }
  }

  if (sessionToken) {
    const session = decryptSession(sessionToken);
    if (session?.id) {
      const id = Number(session.id);
      if (Number.isFinite(id) && id > 0) return id;
    }
    if (session?.email) {
      const user = await prisma.user.findFirst({
        where: { email: String(session.email) },
        select: { id: true },
      });
      if (user?.id) return user.id;
    }
  }

  return null;
}
