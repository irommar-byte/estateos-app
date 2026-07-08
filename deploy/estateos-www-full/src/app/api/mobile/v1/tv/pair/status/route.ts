import { NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';
import { consumeTvPairApproved, getTvPair, normalizePairCode, sweepTvPairStore } from '../_store';

export async function GET(req: Request) {
  const ip = getClientIp(req);
  try {
    const bucket = checkRateLimit(`mobile-tv-pair-status:ip:${ip}`, 120, 60_000);
    if (!bucket.allowed) return rateLimitResponse(bucket.retryAfterSeconds);

    sweepTvPairStore();
    const { searchParams } = new URL(req.url);
    const pairCode = normalizePairCode(searchParams.get('pairCode'));
    if (!pairCode) {
      return NextResponse.json({ success: false, error: 'Brak pairCode' }, { status: 400 });
    }

    const entry = getTvPair(pairCode);
    if (!entry) {
      return NextResponse.json({ success: false, status: 'expired' }, { status: 404 });
    }

    if (entry.status !== 'approved') {
      return NextResponse.json({
        success: true,
        status: 'pending',
        pairCode: entry.pairCode,
        mode: entry.mode,
        expiresInSec: Math.max(1, Math.floor((entry.expiresAt - Date.now()) / 1000)),
      });
    }

    const approved = consumeTvPairApproved(pairCode);
    if (!approved?.token || !approved.user) {
      return NextResponse.json({ success: false, status: 'expired' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      status: 'approved',
      pairCode: approved.pairCode,
      token: approved.token,
      user: approved.user,
    });
  } catch (error) {
    logEvent('error', 'mobile_tv_pair_status_failed', 'api.mobile.v1.tv.pair.status', {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}
