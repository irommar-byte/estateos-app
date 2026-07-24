import { NextResponse } from 'next/server';
import { submitOfferGuestInquiry } from '@/lib/offerGuestInquiry';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') || '';
  const first = fwd.split(',')[0]?.trim();
  if (first) return first;
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const offerId = Number(id);
    if (!Number.isFinite(offerId) || offerId <= 0) {
      return NextResponse.json({ error: 'Nieprawidłowa oferta.' }, { status: 400 });
    }

    const ip = clientIp(req);
    const rlIp = checkRateLimit(`guest-inquiry:ip:${ip}`, 8, 60 * 60 * 1000);
    if (!rlIp.allowed) return rateLimitResponse(rlIp.retryAfterSeconds);

    const rlOffer = checkRateLimit(`guest-inquiry:offer:${offerId}:${ip}`, 3, 60 * 60 * 1000);
    if (!rlOffer.allowed) return rateLimitResponse(rlOffer.retryAfterSeconds);

    const body = await req.json().catch(() => ({}));
    const honeypot = String(body?.website || body?.companyUrl || '').trim();
    if (honeypot) {
      return NextResponse.json({ success: true });
    }

    const result = await submitOfferGuestInquiry({
      offerId,
      questionKey: String(body?.questionKey || ''),
      message: String(body?.message || ''),
      phone: String(body?.phone || ''),
      guestName: String(body?.guestName || ''),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[guest-inquiry] POST', error);
    return NextResponse.json({ error: 'Nie udało się wysłać zapytania.' }, { status: 500 });
  }
}
