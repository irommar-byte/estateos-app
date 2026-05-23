import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';
import { tokenRef } from '@/lib/pushTelemetry';
import { Platform } from '@prisma/client';

const EXPO_PUSH_RE = /^Expo(nent)?PushToken\[/i;

function normalizeEmail(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function detectPlatform(req: Request): Platform {
  const ua = (req.headers.get('user-agent') || '').toLowerCase();
  if (ua.includes('android')) return Platform.ANDROID;
  return Platform.IOS;
}

/** Smoke / CDN — bez sekretów. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/mobile/v1/user/push-token',
    hint: 'POST JSON { email, token } — token Expo; rate limit IP + email.',
  });
}

/**
 * Kanoniczny endpoint mobilny (source of truth = appka): rejestracja Expo push bez Bearer.
 * Mapuje na ten sam model `Device` co `/api/notifications/device`.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);

  const rlIp = checkRateLimit(`mobile-push-token:ip:${ip}`, 40, 60_000);
  if (!rlIp.allowed) return rateLimitResponse(rlIp.retryAfterSeconds);

  try {
    const body = await req.json();
    const email = normalizeEmail(body?.email);
    const expoPushToken = String(body?.token || '')
      .replace(/\s+/g, '')
      .trim();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Nieprawidłowy email' }, { status: 400 });
    }

    const rlEmail = checkRateLimit(`mobile-push-token:email:${email}`, 15, 60 * 60_000);
    if (!rlEmail.allowed) return rateLimitResponse(rlEmail.retryAfterSeconds);

    if (!expoPushToken || expoPushToken.length < 24 || !EXPO_PUSH_RE.test(expoPushToken)) {
      logEvent('warn', 'mobile_push_token_invalid_shape', 'mobile_push_token', { email: '[REDACTED]' });
      return NextResponse.json({ success: false, error: 'Nieprawidłowy token push' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'Użytkownik nie istnieje' }, { status: 404 });
    }

    const userId = user.id;
    const platform = detectPlatform(req);
    const deviceModel = String(req.headers.get('user-agent') || 'Unknown').slice(0, 250);
    const appVersion = 'mobile';

    await prisma.$transaction(async (tx) => {
      await tx.device.updateMany({
        where: {
          expoPushToken,
          userId: { not: userId },
        },
        data: { isActive: false },
      });

      await tx.device.upsert({
        where: {
          userId_expoPushToken: { userId, expoPushToken },
        },
        update: {
          isActive: true,
          platform,
          deviceModel,
          appVersion,
          lastSyncedAt: new Date(),
        },
        create: {
          userId,
          expoPushToken,
          platform,
          deviceModel,
          appVersion,
          isActive: true,
        },
      });
    });

    logEvent('info', 'mobile_push_token_registered', 'mobile_push_token', {
      userId,
      expoPushToken: tokenRef(expoPushToken),
      platform,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logEvent('error', 'mobile_push_token_failed', 'mobile_push_token', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: 'Wewnętrzny błąd serwera' }, { status: 500 });
  }
}
