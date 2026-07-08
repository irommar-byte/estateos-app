import { NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { approveTvPair, normalizePairCode, sweepTvPairStore } from '../_store';

function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const xAccessToken = req.headers.get('x-access-token');
  const authToken = req.headers.get('auth-token');
  const raw = String(authHeader || xAccessToken || authToken || '').trim();
  if (!raw) return null;
  if (raw.startsWith('Bearer ')) return raw.slice('Bearer '.length).trim() || null;
  return raw;
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  try {
    const bucket = checkRateLimit(`mobile-tv-pair-complete:ip:${ip}`, 80, 60_000);
    if (!bucket.allowed) return rateLimitResponse(bucket.retryAfterSeconds);

    const token = extractTokenFromRequest(req);
    if (!token) return NextResponse.json({ success: false, error: 'Brak tokenu' }, { status: 401 });

    const verified = verifyMobileToken(token) as Record<string, unknown> | null;
    const userId = Number(verified?.id || verified?.userId || verified?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ success: false, error: 'Nieprawidłowy token' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const pairCode = normalizePairCode(body?.pairCode);
    if (!pairCode) return NextResponse.json({ success: false, error: 'Brak pairCode' }, { status: 400 });

    sweepTvPairStore();
    const approved = await approveTvPair(pairCode, token, userId);
    if (!approved) {
      return NextResponse.json({ success: false, error: 'Kod parowania wygasł lub jest nieprawidłowy' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      status: 'approved',
      pairCode: approved.pairCode,
    });
  } catch (error) {
    logEvent('error', 'mobile_tv_pair_complete_failed', 'api.mobile.v1.tv.pair.complete', {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}
