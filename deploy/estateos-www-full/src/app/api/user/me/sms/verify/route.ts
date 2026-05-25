import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp } from '@/lib/observability';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rlIp = checkRateLimit(`web-sms-verify:ip:${ip}`, 30, 60_000);
  if (!rlIp.allowed) return rateLimitResponse(rlIp.retryAfterSeconds);

  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Zaloguj się.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const code = String(body?.code ?? body?.smsCode ?? '').trim();
  if (!code) {
    return NextResponse.json({ success: false, error: 'Podaj kod SMS.' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.otpCode !== code) {
    return NextResponse.json({ success: false, error: 'Nieprawidłowy kod.' }, { status: 400 });
  }
  if (user.otpExpiry && new Date() > user.otpExpiry) {
    return NextResponse.json({ success: false, error: 'Kod wygasł. Wyślij nowy.' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { phoneVerifiedAt: new Date(), otpCode: null, otpExpiry: null },
  });

  return NextResponse.json({ success: true, message: 'Telefon potwierdzony.' });
}
