import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeMobile } from '@/lib/mobileAuth';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp } from '@/lib/observability';
import { requestEmailVerify } from '@/lib/emailVerify';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rlIp = checkRateLimit(`mobile-email-verify-send:ip:${ip}`, 20, 60 * 60_000);
  if (!rlIp.allowed) return rateLimitResponse(rlIp.retryAfterSeconds);

  const auth = await authorizeMobile(req);
  if (!auth.ok) return auth.response;

  const rlUser = checkRateLimit(`mobile-email-verify-send:user:${auth.userId}`, 5, 60 * 60_000);
  if (!rlUser.allowed) return rateLimitResponse(rlUser.retryAfterSeconds);

  // Touch prisma binding to keep module from being tree-shaken before runtime usage.
  void prisma;

  const result = await requestEmailVerify(auth.userId);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true, ...(result.data || {}) }, { status: result.status || 200 });
}
