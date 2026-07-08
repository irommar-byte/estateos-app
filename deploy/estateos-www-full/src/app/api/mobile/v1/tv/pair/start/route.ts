import { NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';
import { setTvPairStart, sweepTvPairStore } from '../_store';

export async function POST(req: Request) {
  const ip = getClientIp(req);
  try {
    const bucket = checkRateLimit(`mobile-tv-pair-start:ip:${ip}`, 40, 60_000);
    if (!bucket.allowed) return rateLimitResponse(bucket.retryAfterSeconds);

    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || '').toLowerCase() === 'passkey' ? 'passkey' : 'password';
    const pairCode = String(body?.pairCode || '');
    sweepTvPairStore();
    const entry = setTvPairStart(pairCode, mode);

    return NextResponse.json({
      success: true,
      pairCode: entry.pairCode,
      mode: entry.mode,
      expiresInSec: Math.max(1, Math.floor((entry.expiresAt - Date.now()) / 1000)),
      pollAfterMs: 1800,
    });
  } catch (error) {
    logEvent('error', 'mobile_tv_pair_start_failed', 'api.mobile.v1.tv.pair.start', {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}
