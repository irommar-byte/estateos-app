import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { decryptSession } from '@/lib/sessionUtils';
import { verifyMobileToken } from '@/lib/jwtMobile';

function parseUserIdFromAuthHeader(authHeader: string | null): number | null {
  const raw = String(authHeader || '').trim();
  if (!raw) return null;
  const token = raw.startsWith('Bearer ') ? raw.slice('Bearer '.length).trim() : raw;
  if (!token) return null;

  const verified = verifyMobileToken(token) as any;
  const verifiedId = Number(verified?.id ?? verified?.userId ?? verified?.sub);
  if (Number.isFinite(verifiedId) && verifiedId > 0) return verifiedId;

  const decoded = jwt.decode(token) as any;
  const decodedId = Number(decoded?.id ?? decoded?.userId ?? decoded?.sub);
  return Number.isFinite(decodedId) && decodedId > 0 ? decodedId : null;
}

async function resolveUserId(req: Request): Promise<number | null> {
  const fromHeader =
    parseUserIdFromAuthHeader(req.headers.get('authorization')) ||
    parseUserIdFromAuthHeader(req.headers.get('Authorization')) ||
    parseUserIdFromAuthHeader(req.headers.get('x-access-token')) ||
    parseUserIdFromAuthHeader(req.headers.get('auth-token'));
  if (fromHeader) return fromHeader;

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('estateos_session')?.value || cookieStore.get('luxestate_user')?.value;
  if (!sessionCookie) return null;
  const session = decryptSession(sessionCookie);
  const userId = Number((session as any)?.id);
  if (Number.isFinite(userId) && userId > 0) return userId;
  const email = String((session as any)?.email || '').trim();
  if (!email) return null;
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return user?.id ?? null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

  const resolved = await params;
  const offerId = Number(resolved.id);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ error: 'Nieprawidłowe ID oferty' }, { status: 400 });
  }

  await prisma.favoriteOffer.upsert({
    where: { userId_offerId: { userId, offerId } },
    create: { userId, offerId },
    update: {},
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

  const resolved = await params;
  const offerId = Number(resolved.id);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ error: 'Nieprawidłowe ID oferty' }, { status: 400 });
  }

  await prisma.favoriteOffer.deleteMany({ where: { userId, offerId } });
  return NextResponse.json({ success: true });
}
