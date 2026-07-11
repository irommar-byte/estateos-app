import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendSMS } from '@/lib/sms';
import { mobileBearerUserId, readJson } from '@/lib/mobileApiAuth';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';

export async function POST(req: Request) {
  try {
    const tokenUserId = mobileBearerUserId(req);
    if (!tokenUserId) {
      return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });
    }

    const body = await readJson(req);
    const requestedUserId = Number(body?.userId);
    if (
      Number.isFinite(requestedUserId) &&
      requestedUserId > 0 &&
      requestedUserId !== tokenUserId
    ) {
      return NextResponse.json({ success: false, message: 'Błędny użytkownik w żądaniu' }, { status: 403 });
    }

    const userId = tokenUserId;
    const ip = getClientIp(req);
    const ipBucket = checkRateLimit(`sms-send:ip:${ip}`, 10, 60_000);
    if (!ipBucket.allowed) return rateLimitResponse(ipBucket.retryAfterSeconds);

    const userBucket = checkRateLimit(`sms-send:user:${userId}`, 3, 10 * 60_000);
    if (!userBucket.allowed) return rateLimitResponse(userBucket.retryAfterSeconds);

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
    });

    if (!user || !user.phone) {
      return NextResponse.json({ success: false, message: 'Brak numeru telefonu' }, { status: 400 });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: Number(userId) },
      data: { otpCode, otpExpiry: expiry },
    });

    logEvent('info', 'sms_otp_send', 'mobile.auth.sms.send', { userId, phoneLast4: user.phone.slice(-4) });

    await sendSMS(user.phone, `Kod EstateOS: ${otpCode}`);

    return NextResponse.json({ success: true, message: 'Kod został wysłany.' });
  } catch (error: unknown) {
    logEvent('error', 'sms_otp_send_failed', 'mobile.auth.sms.send', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, message: 'Błąd serwera' }, { status: 500 });
  }
}
