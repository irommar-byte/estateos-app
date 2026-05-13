import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

function getTokenFromReq(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice('Bearer '.length).trim();
  const x = req.headers.get('x-access-token') || req.headers.get('auth-token');
  return x?.trim() || null;
}

function getUserIdFromToken(token: string): number | null {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || '') as { id?: unknown; userId?: unknown; sub?: unknown };
    const id = Number(payload?.id ?? payload?.userId ?? payload?.sub);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * Usuwa wszystkie passkey (WebAuthn) użytkownika zapisane w `Authenticator`.
 * Mobilna aplikacja rejestruje klucz pod tą samą tabelą — revoke musi iść tą samą ścieżką co JWT.
 */
export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromReq(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Brak tokenu.' }, { status: 401 });
    }

    const userIdFromJwt = getUserIdFromToken(token);
    if (!userIdFromJwt) {
      return NextResponse.json({ success: false, error: 'Nieprawidłowy token.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as { userId?: unknown }));
    const bodyUserId = body?.userId != null ? Number(body.userId) : null;
    if (bodyUserId != null && Number.isFinite(bodyUserId) && bodyUserId !== userIdFromJwt) {
      return NextResponse.json({ success: false, error: 'Niezgodność użytkownika.' }, { status: 403 });
    }

    const deleted = await prisma.authenticator.deleteMany({
      where: { userId: userIdFromJwt, providerAccountId: 'passkey' },
    });

    return NextResponse.json({ success: true, deletedCount: deleted.count });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Błąd serwera';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
