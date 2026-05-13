import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { expandPhoneSearchVariants, normalizePhoneForStorage } from '@/lib/phoneLookup';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp } from '@/lib/observability';

/**
 * POST /api/auth/check-exists
 * Body: { phone?: string, email?: string } — przynajmniej jedno pole.
 * Odpowiedź: { exists: boolean, field?: 'phone'|'email' } (bez ujawniania czyje to konto).
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const bucket = checkRateLimit(`check-exists:ip:${ip}`, 60, 60_000);
  if (!bucket.allowed) return rateLimitResponse(bucket.retryAfterSeconds);

  try {
    const body = await req.json().catch(() => ({}));
    const emailRaw = String(body?.email || '').trim().toLowerCase();
    const phoneRaw = String(body?.phone || '').trim();

    if (!emailRaw && !phoneRaw) {
      return NextResponse.json({ success: false, error_code: 'MISSING_FIELDS', message: 'Brak email lub telefonu.' }, { status: 400 });
    }

    if (emailRaw) {
      const u = await prisma.user.findUnique({ where: { email: emailRaw }, select: { id: true } });
      if (u) return NextResponse.json({ success: true, exists: true, field: 'email' });
    }

    if (phoneRaw) {
      const canonical = normalizePhoneForStorage(phoneRaw);
      if (!canonical) {
        return NextResponse.json({ success: true, exists: false, field: 'phone' });
      }
      const variants = expandPhoneSearchVariants(phoneRaw);
      const u = await prisma.user.findFirst({
        where: { OR: variants.map((p) => ({ phone: p })) },
        select: { id: true },
      });
      if (u) return NextResponse.json({ success: true, exists: true, field: 'phone' });
    }

    return NextResponse.json({ success: true, exists: false });
  } catch (e) {
    console.error('[check-exists]', e);
    return NextResponse.json({ success: false, error_code: 'INTERNAL_ERROR', message: 'Błąd serwera.' }, { status: 500 });
  }
}
