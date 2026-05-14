import { SignJWT } from 'jose';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { encryptSession } from '@/lib/sessionUtils';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';

export async function POST(req: Request) {
  const ip = getClientIp(req);

  try {
    const body = await req.json();
    const email = String(body?.email || body?.login || '').trim().toLowerCase();
    const password = String(body?.password || '');

    const ipBucket = checkRateLimit(`auth-login:ip:${ip}`, 20, 60_000);
    if (!ipBucket.allowed) return rateLimitResponse(ipBucket.retryAfterSeconds);

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Brak danych' }, { status: 400 });
    }

    const idBucket = checkRateLimit(`auth-login:id:${email}`, 8, 60_000);
    if (!idBucket.allowed) return rateLimitResponse(idBucket.retryAfterSeconds);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return NextResponse.json({ success: false, message: 'Błędne dane logowania' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json({ success: false, message: 'Błędne dane logowania' }, { status: 401 });
    }

    if (!user.password.startsWith('$2b$')) {
      const newHash = await bcrypt.hash(password, 10);
      await prisma.user.update({ where: { id: user.id }, data: { password: newHash } });
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');
    const token = await new SignJWT({ id: user.id, email: user.email, role: user.role || 'USER' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(secret);

    const estateosSession = encryptSession({
      id: user.id,
      email: user.email,
      role: user.role || 'USER',
      name: user.name || '',
    });

    const response = NextResponse.json({
      success: true,
      token,
      role: user.role || 'USER',
      name: user.name,
      id: user.id,
    });

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    };

    response.cookies.set({ name: 'estateos_session', value: estateosSession, ...cookieOptions });
    response.cookies.set({ name: 'luxestate_user', value: estateosSession, ...cookieOptions });
    response.cookies.set({ name: 'deal_token', value: token, httpOnly: false, path: '/' });

    return response;
  } catch (error) {
    logEvent('error', 'auth_login_failed', 'api.auth.login', {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, message: 'Błąd serwera' }, { status: 500 });
  }
}
