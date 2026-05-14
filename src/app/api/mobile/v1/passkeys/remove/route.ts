export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/jwtMobile';

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
    const deleted = await prisma.authenticator.deleteMany({
      where: {
        userId,
        providerAccountId: 'passkey',
        credentialID: credentialId,
      },
    });
    return NextResponse.json(
      { success: true, deletedCount: deleted.count },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const deleted = await prisma.authenticator.deleteMany({
    where: { userId, providerAccountId: 'passkey' },
  });

  return NextResponse.json(
    { success: true, deletedCount: deleted.count },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

/** Wyłączenie Passkey w aplikacji — usuwa rekord(y) w `Authenticator`, żeby login passkey nie działał po wylogowaniu. */
export async function POST(req: Request) {
  try {
    return await removePasskeys(req);
  } catch (e: any) {
    console.error('[MOBILE PASSKEY REMOVE]', e);
    return NextResponse.json({ success: false, message: e?.message || 'Błąd serwera' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    return await removePasskeys(req);
  } catch (e: any) {
    console.error('[MOBILE PASSKEY REMOVE]', e);
    return NextResponse.json({ success: false, message: e?.message || 'Błąd serwera' }, { status: 500 });
  }
}
