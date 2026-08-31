import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signMobileToken } from '@/lib/jwtMobile';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';
import { recordUserLogin } from '@/lib/recordUserLogin';
import { MOBILE_USER_SELECT } from '@/lib/mobileUserShape';
import { shapeMobileUserEntitled } from '@/lib/mobileUserShapeEntitled';
import { userHasRegisteredPasskey } from '@/lib/mobilePasskeyStatus';
import { activatePortalAccount } from '@/lib/crm/portalAccountLink';

type RouteCtx = { params: Promise<{ token: string }> };

export async function POST(req: Request, ctx: RouteCtx) {
  const ip = getClientIp(req);
  try {
    const limit = checkRateLimit(`portal-activate:ip:${ip}`, 12, 15 * 60_000);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 });
    }

    const { token } = await ctx.params;
    const result = await activatePortalAccount({
      portalToken: token,
      email: String(body.email || ''),
      password: String(body.password || ''),
      phoneSuffix: body.phoneSuffix != null ? String(body.phoneSuffix) : undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: result.userId },
      select: MOBILE_USER_SELECT,
    });
    if (!fullUser) {
      return NextResponse.json({ error: 'Nie znaleziono konta po aktywacji.' }, { status: 500 });
    }

    const jwt = signMobileToken({ id: fullUser.id, email: fullUser.email, role: fullUser.role });
    const hasPasskey = await userHasRegisteredPasskey(fullUser.id);
    await recordUserLogin(fullUser.id, ip);

    return NextResponse.json({
      success: true,
      created: result.created,
      linkedUserId: result.userId,
      token: jwt,
      user: { ...await shapeMobileUserEntitled(fullUser), hasPasskey },
    });
  } catch (error) {
    logEvent('error', 'portal_activate_failed', 'api.crm.client-portal.activate', {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Nie udało się aktywować panelu.' }, { status: 500 });
  }
}
