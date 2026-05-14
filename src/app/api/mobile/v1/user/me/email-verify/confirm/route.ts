import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeMobile } from '@/lib/mobileAuth';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp } from '@/lib/observability';
import { confirmEmailVerify } from '@/lib/emailVerify';
import { MOBILE_USER_SELECT, shapeMobileUser } from '@/lib/mobileUserShape';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rlIp = checkRateLimit(`mobile-email-verify-confirm:ip:${ip}`, 40, 60 * 60_000);
  if (!rlIp.allowed) return rateLimitResponse(rlIp.retryAfterSeconds);

  const auth = await authorizeMobile(req);
  if (!auth.ok) return auth.response;

  const rlUser = checkRateLimit(`mobile-email-verify-confirm:user:${auth.userId}`, 10, 60 * 60_000);
  if (!rlUser.allowed) return rateLimitResponse(rlUser.retryAfterSeconds);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const result = await confirmEmailVerify(auth.userId, body.code ?? body.otp ?? body.token);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  const updated = await prisma.user.findUnique({ where: { id: auth.userId }, select: MOBILE_USER_SELECT });
  return NextResponse.json(
    { success: true, user: updated ? shapeMobileUser(updated) : null },
    { status: 200 }
  );
}
