import bcrypt from 'bcrypt';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptSession } from '@/lib/sessionUtils';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';
import { expandPhoneSearchVariants } from '@/lib/phoneLookup';

function looksLikePhoneLogin(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 9;
}

export type PasswordAuthSuccess = {
  ok: true;
  user: { id: number; email: string; role: string };
  sessionToken: string;
};

export type PasswordAuthFailure = {
  ok: false;
  status: number;
  body: Record<string, unknown>;
  retryAfterSeconds?: number;
};

export type PasswordAuthResult = PasswordAuthSuccess | PasswordAuthFailure;

/**
 * Wspólna logika logowania hasłem (e-mail lub telefon) — używana przez `/api/login` i `/api/auth/login`.
 */
export async function authenticatePasswordForRequest(req: Request, body: unknown): Promise<PasswordAuthResult> {
  const ip = getClientIp(req);

  const ipBucket = checkRateLimit(`legacy-login:ip:${ip}`, 15, 60_000);
  if (!ipBucket.allowed) {
    return {
      ok: false,
      status: 429,
      body: {
        success: false,
        message: 'Zbyt wiele prób. Spróbuj za chwilę.',
        error: 'Zbyt wiele prób. Spróbuj za chwilę.',
      },
      retryAfterSeconds: ipBucket.retryAfterSeconds,
    };
  }

  try {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const login = String(b.login ?? b.email ?? '')
      .trim()
      .toLowerCase();
    const password = String(b.password ?? '');

    if (!login || !password) {
      return {
        ok: false,
        status: 400,
        body: { success: false, message: 'Brak danych logowania.', error: 'Brak danych logowania.' },
      };
    }

    const idBucket = checkRateLimit(`legacy-login:id:${login}`, 8, 60_000);
    if (!idBucket.allowed) {
      return {
        ok: false,
        status: 429,
        body: {
          success: false,
          message: 'Zbyt wiele prób dla tego konta.',
          error: 'Zbyt wiele prób dla tego konta.',
        },
        retryAfterSeconds: idBucket.retryAfterSeconds,
      };
    }

    const phoneOr = looksLikePhoneLogin(login) ? expandPhoneSearchVariants(login).map((p) => ({ phone: p })) : [];

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: login }, ...phoneOr],
      },
    });

    if (!user || !user.password) {
      return {
        ok: false,
        status: 401,
        body: {
          success: false,
          message: 'Nieprawidłowy e-mail lub hasło.',
          error: 'Nieprawidłowy e-mail lub hasło.',
        },
      };
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return {
        ok: false,
        status: 401,
        body: {
          success: false,
          message: 'Nieprawidłowy e-mail lub hasło.',
          error: 'Nieprawidłowy e-mail lub hasło.',
        },
      };
    }

    const sessionToken = encryptSession({ id: user.id, email: user.email });
    return {
      ok: true,
      user: { id: user.id, email: user.email, role: user.role },
      sessionToken,
    };
  } catch (error) {
    logEvent('error', 'password_auth_failed', 'passwordAuth', {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      status: 500,
      body: { success: false, message: 'Błąd serwera.', error: 'Błąd serwera.' },
    };
  }
}

export function applyEstateosSessionCookie(res: NextResponse, sessionToken: string) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookies.set('estateos_session', sessionToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function jsonWithOptionalRateLimit(result: PasswordAuthFailure) {
  if (result.retryAfterSeconds != null) {
    return rateLimitResponse(result.retryAfterSeconds);
  }
  return NextResponse.json(result.body, { status: result.status });
}
