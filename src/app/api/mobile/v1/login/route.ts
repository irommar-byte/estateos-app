import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { signMobileToken } from '@/lib/jwtMobile';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';
import { MOBILE_USER_SELECT, shapeMobileUser } from '@/lib/mobileUserShape';

export async function POST(req: Request) {
  const ip = getClientIp(req);

  try {
    const body = await req.json();
    const email = String(body?.email || body?.identifier || body?.login || '').trim().toLowerCase();
    const password = String(body?.password || '');

    const ipBucket = checkRateLimit(`mobile-login:ip:${ip}`, 20, 60_000);
    if (!ipBucket.allowed) return rateLimitResponse(ipBucket.retryAfterSeconds);

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Brak emaila lub hasła' }, { status: 400 });
    }

    const idBucket = checkRateLimit(`mobile-login:id:${email}`, 8, 60_000);
    if (!idBucket.allowed) return rateLimitResponse(idBucket.retryAfterSeconds);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy email lub hasło' }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy email lub hasło' }, { status: 401 });
    }

    const token = signMobileToken({ id: user.id, email: user.email, role: user.role });
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: MOBILE_USER_SELECT,
    });

    return NextResponse.json({
      success: true,
      user: fullUser ? shapeMobileUser(fullUser) : null,
      token,
    });
  } catch (error) {
    logEvent('error', 'mobile_login_failed', 'api.mobile.v1.login', {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, message: 'Błąd serwera podczas logowania' }, { status: 500 });
  }
}
