import { NextResponse } from 'next/server';
import { authorizeMobile } from '@/lib/mobileAuth';
import { getClientIp } from '@/lib/observability';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { parseDiscoveryIncomingEvent } from '@/lib/discovery/events';
import { persistDiscoveryEvent } from '@/lib/discovery/persistDiscoveryEvent';

export async function POST(req: Request) {
  try {
    const auth = await authorizeMobile(req);
    if (!auth.ok) return auth.response;
    const userId = auth.userId;
    const ipBucket = checkRateLimit(`discovery-events:ip:${getClientIp(req)}`, 120, 60_000);
    if (!ipBucket.allowed) return rateLimitResponse(ipBucket.retryAfterSeconds);
    const userBucket = checkRateLimit(`discovery-events:user:${userId}`, 90, 60_000);
    if (!userBucket.allowed) return rateLimitResponse(userBucket.retryAfterSeconds);

    const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const rawType = String(raw.eventType || '').trim().toUpperCase();
    const wantsSeriousTrope =
      rawType === 'SERIOUS' ||
      rawType === 'DISCOVERY_PRIORITY' ||
      rawType === 'DISCOVERY_FAST_TRACK';

    const parsed = parseDiscoveryIncomingEvent({
      ...raw,
      platform: String(raw.platform || 'ios').slice(0, 16),
      source: String(raw.source || 'mobile_discovery').slice(0, 32),
    });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const result = await persistDiscoveryEvent(userId, parsed.event, {
      upsertSeriousTrope: wantsSeriousTrope,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, id: result.id, idempotent: result.idempotent });
  } catch (error) {
    console.error('[DISCOVERY EVENTS ERROR]', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
