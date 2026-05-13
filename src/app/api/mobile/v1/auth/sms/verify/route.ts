import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp } from '@/lib/observability';

/**
 * POST /api/mobile/v1/auth/sms/verify
 * Body: { userId: number, code: string } — zgodnie z `SmsVerificationScreen.tsx`.
 *
 * Po sukcesie ustawiamy `phoneVerifiedAt` (weryfikacja telefonu), czyścimy OTP.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const bucket = checkRateLimit(`sms-verify:ip:${ip}`, 40, 60_000);
  if (!bucket.allowed) return rateLimitResponse(bucket.retryAfterSeconds);

  try {
    const body = await req.json().catch(() => ({}));
    const userId = Number(body?.userId ?? 0);
    const code = String(body?.code ?? body?.otp ?? '').trim();

    if (!Number.isFinite(userId) || userId <= 0 || !code) {
      return NextResponse.json({ success: false, message: 'Brak danych weryfikacji.' }, { status: 400 });
    }

    const idBucket = checkRateLimit(`sms-verify:user:${userId}`, 15, 60_000);
    if (!idBucket.allowed) return rateLimitResponse(idBucket.retryAfterSeconds);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, otpCode: true, otpExpiry: true },
    });

    if (!user?.otpCode) {
      return NextResponse.json({ success: false, message: 'Brak aktywnego kodu. Wyślij SMS ponownie.' }, { status: 400 });
    }

    if (user.otpExpiry && new Date(user.otpExpiry) < new Date()) {
      return NextResponse.json({ success: false, message: 'Kod wygasł. Wyślij nowy SMS.' }, { status: 400 });
    }

    if (String(user.otpCode).trim() !== code) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy kod.' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        otpCode: null,
        otpExpiry: null,
        phoneVerifiedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, message: 'Numer zweryfikowany.' });
  } catch (e: any) {
    console.error('[SMS VERIFY]', e);
    return NextResponse.json({ success: false, message: e?.message || 'Błąd serwera.' }, { status: 500 });
  }
}
