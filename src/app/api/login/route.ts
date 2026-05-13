import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { encryptSession } from '@/lib/sessionUtils';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';

import { expandPhoneSearchVariants } from '@/lib/phoneLookup';

function looksLikePhoneLogin(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 9;
}

export async function POST(req: Request) {
  const ip = getClientIp(req);

  const ipBucket = checkRateLimit(`legacy-login:ip:${ip}`, 15, 60_000);
  if (!ipBucket.allowed) {
    return rateLimitResponse(ipBucket.retryAfterSeconds);
  }

  try {
    const body = await req.json();
    const login = String(body?.login || body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');

    if (!login || !password) {
      return NextResponse.json({ error: 'Brak danych' }, { status: 400 });
    }

    const idBucket = checkRateLimit(`legacy-login:id:${login}`, 8, 60_000);
    if (!idBucket.allowed) {
      return rateLimitResponse(idBucket.retryAfterSeconds);
    }

    const phoneOr = looksLikePhoneLogin(login)
      ? expandPhoneSearchVariants(login).map((p) => ({ phone: p }))
      : [];

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: login }, ...phoneOr],
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Nieprawidłowe dane' }, { status: 401 });
    }

    const valid = user.password ? await bcrypt.compare(password, user.password) : false;
    if (!valid) {
      return NextResponse.json({ error: 'Nieprawidłowe dane' }, { status: 401 });
    }

    const session = encryptSession({ id: user.id });
    const res = NextResponse.json({ success: true });
    res.cookies.set('estateos_session', session, { httpOnly: true, path: '/' });

    return res;
  } catch (error) {
    logEvent('error', 'legacy_login_failed', 'api.login', {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
