export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { normalizeCredentialIdToBase64URL } from '@/lib/passkeyDbEncoding';

function parseUserIdFromBearer(req: Request): number | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const rawToken = auth.replace(/^Bearer\s+/i, '').trim();
  if (!rawToken) return null;
  const payload = verifyMobileToken(rawToken) as Record<string, unknown> | null;
  const userId = Number(payload?.id ?? payload?.userId ?? payload?.sub);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

async function removePasskeys(req: Request) {
  const userId = parseUserIdFromBearer(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const credentialId =
    typeof body?.credentialId === 'string'
      ? body.credentialId.trim()
      : typeof body?.credentialID === 'string'
        ? body.credentialID.trim()
        : '';

  if (credentialId) {
    let deleted = await prisma.authenticator.deleteMany({
      where: {
        userId,
        credentialID: credentialId,
      },
    });
    if (deleted.count === 0) {
      try {
        const normalized = normalizeCredentialIdToBase64URL(credentialId);
        if (normalized !== credentialId) {
          deleted = await prisma.authenticator.deleteMany({
            where: {
              userId,
              credentialID: normalized,
            },
          });
        }
      } catch {
        // ignore: malformed credential id
      }
    }
    if (deleted.count === 0) {
      return NextResponse.json(
        { success: false, message: 'Nie znaleziono klucza dla tego urządzenia' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: true, deletedCount: deleted.count, hasPasskey: false },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  /** Wszystkie wpisy WebAuthn użytkownika (WWW używa `passkey`, legacy `/api/passkey/register/finish` — `passkey_*`). */
  const deleted = await prisma.authenticator.deleteMany({
    where: { userId },
  });

  return NextResponse.json(
    {
      success: true,
      deletedCount: deleted.count,
      hasPasskey: false,
      message:
        deleted.count > 0
          ? 'Wszystkie klucze Passkey zostały usunięte.'
          : 'Brak aktywnych kluczy Passkey do usunięcia.',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

/** Wyłączenie Passkey w aplikacji — usuwa rekord(y) w `Authenticator`, żeby login passkey nie działał po wylogowaniu. */
export async function POST(req: Request) {
  try {
    return await removePasskeys(req);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Błąd serwera';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    return await removePasskeys(req);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Błąd serwera';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
