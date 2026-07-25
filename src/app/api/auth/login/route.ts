import { SignJWT } from 'jose';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { encryptSession, resolveSessionSecret } from '@/lib/sessionUtils';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';
import { recordUserLogin } from '@/lib/recordUserLogin';
import { buildPhoneLookupVariants } from '@/lib/phoneE164';

export async function POST(req: Request) {
  const ip = getClientIp(req);

  try {
    const body = await req.json();
    /** Ten sam kontrakt co `api/mobile/v1/auth/login` — aplikacja jest źródłem prawdy. */
    const rawLogin = String(body?.email || body?.identifier || body?.login || '').trim();
    const password = String(body?.password || '');
    const emailKey = rawLogin.toLowerCase().replace(/\s+/g, '');
    const phoneDigits = rawLogin.replace(/\D/g, '');

    const ipBucket = checkRateLimit(`auth-login:ip:${ip}`, 20, 60_000);
    if (!ipBucket.allowed) return rateLimitResponse(ipBucket.retryAfterSeconds);

    if ((!emailKey && !phoneDigits) || !password) {
      return NextResponse.json({ success: false, message: 'Brak danych' }, { status: 400 });
    }

    const rateKey = emailKey || phoneDigits || rawLogin;
    const idBucket = checkRateLimit(`auth-login:id:${rateKey}`, 8, 60_000);
    if (!idBucket.allowed) return rateLimitResponse(idBucket.retryAfterSeconds);

    let user: Awaited<ReturnType<typeof prisma.user.findUnique>> = null;

    if (rawLogin.includes('@')) {
      /** Wyłącznie email — nigdy nie mieszaj z OR po telefonie z cyfr w lokalnej części adresu. */
      user = await prisma.user.findUnique({ where: { email: emailKey } });
    } else if (phoneDigits.length >= 9) {
      const phoneOr: Array<{ phone: string }> = [];
      phoneOr.push({ phone: phoneDigits });
      if (!phoneDigits.startsWith('48')) {
        phoneOr.push({ phone: `48${phoneDigits}` });
        phoneOr.push({ phone: `+48${phoneDigits}` });
      } else {
        phoneOr.push({ phone: `+${phoneDigits}` });
      }
      user = await prisma.user.findFirst({
        where: { OR: phoneOr },
      });
    } else {
      /** Mobilne logowanie: samo `email` (np. krótki identyfikator w dev). */
      user = await prisma.user.findUnique({ where: { email: emailKey } });
    }
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

    let jwtSecret: string;
    try {
      jwtSecret = resolveSessionSecret();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Brak konfiguracji klucza sesji/JWT na serwerze' },
        { status: 500 }
      );
    }
    const secret = new TextEncoder().encode(jwtSecret);
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
    response.cookies.set({
      name: 'deal_token',
      value: token,
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    await recordUserLogin(user.id, ip);

    return response;
  } catch (error) {
    logEvent('error', 'auth_login_failed', 'api.auth.login', {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, message: 'Błąd serwera' }, { status: 500 });
  }
}
