import { NextResponse } from 'next/server';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { confirmEmailVerify } from '@/lib/emailVerify';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp } from '@/lib/observability';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rlIp = checkRateLimit(`web-email-verify-confirm:ip:${ip}`, 40, 60 * 60_000);
  if (!rlIp.allowed) return rateLimitResponse(rlIp.retryAfterSeconds);

  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Zaloguj się.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const code = body?.code ?? body?.otp ?? body?.token;
  const result = await confirmEmailVerify(userId, code);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true });
}
