import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendSMS } from '@/lib/sms';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp } from '@/lib/observability';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rlIp = checkRateLimit(`web-sms-send:ip:${ip}`, 15, 60_000);
  if (!rlIp.allowed) return rateLimitResponse(rlIp.retryAfterSeconds);

  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Zaloguj się.' }, { status: 401 });
  }

  const rlUser = checkRateLimit(`web-sms-send:user:${userId}`, 5, 60_000);
  if (!rlUser.allowed) return rateLimitResponse(rlUser.retryAfterSeconds);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
  if (!user?.phone) {
    return NextResponse.json({ success: false, error: 'Uzupełnij numer telefonu w profilu.' }, { status: 400 });
  }

  const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
  const expiry = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: { otpCode, otpExpiry: expiry },
  });

  await sendSMS(user.phone, `Kod EstateOS: ${otpCode}`);

  return NextResponse.json({ success: true, message: 'Kod SMS został wysłany.' });
}
