import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/jwtMobile';
import jwt from 'jsonwebtoken';

/** Authorization: Bearer <token> (mobile JWT). */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const raw = String(authHeader || '').trim();
  if (!raw) return null;
  return raw.startsWith('Bearer ') ? raw.slice('Bearer '.length).trim() : raw;
}

export function parseUserIdFromMobileJwt(token: string): number | null {
  const verified = verifyMobileToken(token) as Record<string, unknown> | null;
  const verifiedId = Number(verified?.id ?? verified?.userId ?? verified?.sub);
  if (Number.isFinite(verifiedId) && verifiedId > 0) return verifiedId;

  const decoded = jwt.decode(token) as Record<string, unknown> | null;
  const decodedId = Number(decoded?.id ?? decoded?.userId ?? decoded?.sub);
  if (Number.isFinite(decodedId) && decodedId > 0) return decodedId;

  return null;
}

/**
 * Chronione akcje panelu admina z aplikacji mobilnej — wymagają JWT + roli ADMIN.
 * (Mobile = SoT: ekrany admin mają wysyłać Bearer; backend musi odrzucać brak tokena.)
 */
export async function requireMobileAdmin(req: Request) {
  const token = extractBearerToken(req);
  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 }),
    };
  }

  const userId = parseUserIdFromMobileJwt(token);
  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, message: 'Nieprawidłowy token' }, { status: 401 }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, message: 'Nieprawidłowy token' }, { status: 401 }),
    };
  }

  if (user.role !== 'ADMIN') {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, message: 'Brak uprawnień admina' }, { status: 403 }),
    };
  }

  return { ok: true as const, adminId: user.id };
}
