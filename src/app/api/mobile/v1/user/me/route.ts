import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';
import { MOBILE_USER_SELECT, shapeMobileUser } from '@/lib/mobileUserShape';

const PROFILE_SELECT = MOBILE_USER_SELECT;
const shapeProfileResponse = shapeMobileUser;

async function authorize(req: Request) {
  const token = extractTokenFromRequest(req);
  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 }),
    };
  }
  const payload = verifyMobileToken(token);
  if (!payload) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, message: 'Nieprawidłowy lub wygasły token' },
        { status: 401 }
      ),
    };
  }
  const userId = parseUserIdFromVerifiedPayload(payload);
  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, message: 'Nieprawidłowy token' },
        { status: 401 }
      ),
    };
  }
  return { ok: true as const, userId };
}

function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const xAccessToken = req.headers.get('x-access-token');
  const authToken = req.headers.get('auth-token');
  const raw = String(authHeader || xAccessToken || authToken || '').trim();
  if (!raw) return null;
  if (raw.startsWith('Bearer ')) return raw.slice('Bearer '.length).trim() || null;
  return raw;
}

function parseUserIdFromVerifiedPayload(payload: unknown): number | null {
  const p = payload as Record<string, unknown> | null;
  if (!p) return null;
  const id = Number(p.id ?? p.userId ?? p.sub);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Kasowanie konta z aplikacji mobilnej — wymaga poprawnego JWT + hasła.
 * Relacje w Prisma są w większości onDelete: Cascade (oferty, deale jako strona,
 * urządzenia, passkey itd.).
 */
export async function DELETE(req: Request) {
  const ip = getClientIp(req);

  const rlIp = checkRateLimit(`mobile-delete-account:ip:${ip}`, 10, 60 * 60_000);
  if (!rlIp.allowed) return rateLimitResponse(rlIp.retryAfterSeconds);

  try {
    const token = extractTokenFromRequest(req);
    if (!token) {
      return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });
    }

    const payload = verifyMobileToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy lub wygasły token' }, { status: 401 });
    }

    const userId = parseUserIdFromVerifiedPayload(payload);
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy token' }, { status: 401 });
    }

    const rlUser = checkRateLimit(`mobile-delete-account:user:${userId}`, 5, 60 * 60_000);
    if (!rlUser.allowed) return rateLimitResponse(rlUser.retryAfterSeconds);

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    const password = String(body?.password ?? '');
    if (!password) {
      return NextResponse.json(
        { success: false, message: 'Podaj hasło aby potwierdzić usunięcie konta.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, role: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'Użytkownik nie istnieje' }, { status: 404 });
    }

    if (user.role === 'ADMIN') {
      return NextResponse.json(
        {
          success: false,
          message: 'Nie można usunąć konta administratora tą ścieżką — skontaktuj się z obsługą.',
        },
        { status: 403 }
      );
    }

    if (!user.password) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Konto bez hasła (np. wyłącznie Passkey). Ustaw hasło przez funkcję resetu / ustawienia, potem ponów usunięcie konta.',
        },
        { status: 403 }
      );
    }

    const passwordOk = await bcrypt.compare(password, user.password);
    if (!passwordOk) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowe hasło' }, { status: 401 });
    }

    await prisma.user.delete({ where: { id: userId } });

    logEvent('warn', 'account_deleted_mobile', 'mobile_delete_account', {
      userId,
      ip,
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logEvent('error', 'account_delete_failed_mobile', 'mobile_delete_account', {
      message: msg,
      ip,
    });
    return NextResponse.json(
      {
        success: false,
        message: 'Nie udało się usunąć konta — spróbuj ponownie lub skontaktuj się z obsługą.',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.response;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: PROFILE_SELECT,
  });
  if (!user) {
    return NextResponse.json({ success: false, message: 'Użytkownik nie istnieje' }, { status: 404 });
  }

  return NextResponse.json({ success: true, user: shapeProfileResponse(user) });
}

function sanitizeString(value: unknown, max = 120): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const str = String(value).trim();
  if (!str) return null;
  return str.slice(0, max);
}

function sanitizePhone(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const cleaned = String(value).replace(/[^\d+]/g, '').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 32);
}

export async function PATCH(req: Request) {
  const ip = getClientIp(req);

  const rlIp = checkRateLimit(`mobile-profile-edit:ip:${ip}`, 60, 60_000);
  if (!rlIp.allowed) return rateLimitResponse(rlIp.retryAfterSeconds);

  const auth = await authorize(req);
  if (!auth.ok) return auth.response;

  const rlUser = checkRateLimit(`mobile-profile-edit:user:${auth.userId}`, 30, 60_000);
  if (!rlUser.allowed) return rateLimitResponse(rlUser.retryAfterSeconds);

  try {
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const current = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: PROFILE_SELECT,
    });
    if (!current) {
      return NextResponse.json({ success: false, message: 'Użytkownik nie istnieje' }, { status: 404 });
    }

    const data: Prisma.UserUpdateInput = {};

    let nextName = sanitizeString(body.name, 120);

    if (nextName === undefined) {
      const firstName = sanitizeString(body.firstName, 60);
      const lastName = sanitizeString(body.lastName, 60);
      if (firstName !== undefined || lastName !== undefined) {
        const currentParts = String(current.name || '').trim().split(/\s+/);
        const currentFirst = currentParts[0] || '';
        const currentLast = currentParts.slice(1).join(' ');
        const finalFirst = firstName === undefined ? currentFirst : firstName || '';
        const finalLast = lastName === undefined ? currentLast : lastName || '';
        nextName = [finalFirst, finalLast].filter(Boolean).join(' ').trim() || null;
      }
    }

    if (nextName !== undefined) {
      if (current.role === 'AGENT' || current.role === 'ADMIN') {
        return NextResponse.json(
          { success: false, message: 'Zmiana imienia/nazwiska zablokowana dla tego konta.' },
          { status: 403 }
        );
      }
      data.name = nextName;
    }

    const phone = sanitizePhone(body.phone);
    if (phone !== undefined) data.phone = phone;

    const image = body.image === undefined ? undefined : sanitizeString(body.image, 4000);
    if (image !== undefined) data.image = image;

    const companyName = sanitizeString(body.companyName, 200);
    if (companyName !== undefined) data.companyName = companyName;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: true, user: shapeProfileResponse(current) });
    }

    try {
      const updated = await prisma.user.update({
        where: { id: auth.userId },
        data,
        select: PROFILE_SELECT,
      });

      logEvent('info', 'profile_updated_mobile', 'mobile_profile_edit', {
        userId: auth.userId,
        fields: Object.keys(data),
      });

      return NextResponse.json({ success: true, user: shapeProfileResponse(updated) });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = Array.isArray(e.meta?.target) ? (e.meta?.target as string[]).join(',') : String(e.meta?.target || '');
        const isPhone = target.includes('phone');
        return NextResponse.json(
          {
            success: false,
            message: isPhone
              ? 'Ten numer telefonu jest już używany przez inne konto.'
              : 'Konflikt unikalności pola profilu.',
          },
          { status: 409 }
        );
      }
      throw e;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logEvent('error', 'profile_update_failed_mobile', 'mobile_profile_edit', { message: msg, ip });
    return NextResponse.json(
      { success: false, message: 'Nie udało się zaktualizować profilu.' },
      { status: 500 }
    );
  }
}

// Alias zgodności: niektóre wersje klienta wysyłają PUT zamiast PATCH.
export async function PUT(req: Request) {
  return PATCH(req);
}
