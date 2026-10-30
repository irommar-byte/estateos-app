import { NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { buildSignedPass, PassConfigError, PassInputError, passRequestSchema } from '@/lib/paragonosPass';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function clientIp(req: Request): string {
  const first = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim();
  return first || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

// Signs Apple Wallet loyalty passes for the ParagonOS iOS app. Nothing is stored.
export async function POST(req: Request) {
  const ip = clientIp(req);
  const minute = checkRateLimit(`paragonos-pass:min:${ip}`, 10, 60 * 1000);
  if (!minute.allowed) return rateLimitResponse(minute.retryAfterSeconds);
  const day = checkRateLimit(`paragonos-pass:day:${ip}`, 100, 24 * 60 * 60 * 1000);
  if (!day.allowed) return rateLimitResponse(day.retryAfterSeconds);

  const body = await req.json().catch(() => null);
  const parsed = passRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Nieprawidłowe dane karty.' }, { status: 400 });
  }

  try {
    const pkpass = await buildSignedPass(parsed.data);
    return new Response(new Uint8Array(pkpass), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof PassInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof PassConfigError) {
      console.error('[paragonos/pass]', error.message);
      return NextResponse.json({ error: 'Podpis kart jest chwilowo niedostępny.' }, { status: 503 });
    }
    console.error('[paragonos/pass] sign failed', error);
    return NextResponse.json({ error: 'Nie udało się podpisać karty.' }, { status: 500 });
  }
}
