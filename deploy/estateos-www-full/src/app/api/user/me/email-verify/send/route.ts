import { NextResponse } from 'next/server';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { requestEmailVerify } from '@/lib/emailVerify';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp } from '@/lib/observability';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rlIp = checkRateLimit(`web-email-verify-send:ip:${ip}`, 20, 60 * 60_000);
  if (!rlIp.allowed) return rateLimitResponse(rlIp.retryAfterSeconds);

  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Zaloguj się.' }, { status: 401 });
  }

  const rlUser = checkRateLimit(`web-email-verify-send:user:${userId}`, 5, 60 * 60_000);
  if (!rlUser.allowed) return rateLimitResponse(rlUser.retryAfterSeconds);

  const result = await requestEmailVerify(userId);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true, ...(result.data || {}) });
}
