import { NextResponse } from 'next/server';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { getClientIp } from '@/lib/observability';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { parseDiscoveryIncomingEvent } from '@/lib/discovery/events';
import { persistDiscoveryEvent } from '@/lib/discovery/persistDiscoveryEvent';

/**
 * Web Discovery decisions (session cookie auth).
 * Accepts full event types or Apple-simple shorthand: LIKE | DISLIKE | OPEN | SERIOUS.
 */
export async function POST(req: Request) {
  try {
    const userId = await resolveWebUserId(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Zaloguj się, aby zapisać preferencje.' }, { status: 401 });
    }

    const ipBucket = checkRateLimit(`discovery-events-web:ip:${getClientIp(req)}`, 120, 60_000);
    if (!ipBucket.allowed) return rateLimitResponse(ipBucket.retryAfterSeconds);
    const userBucket = checkRateLimit(`discovery-events-web:user:${userId}`, 90, 60_000);
    if (!userBucket.allowed) return rateLimitResponse(userBucket.retryAfterSeconds);

    const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const rawType = String(raw.eventType || '').trim().toUpperCase();
    const wantsSeriousTrope = rawType === 'SERIOUS' || rawType === 'DISCOVERY_PRIORITY' || rawType === 'DISCOVERY_FAST_TRACK';

    const parsed = parseDiscoveryIncomingEvent({
      ...raw,
      platform: 'web',
      source: String(raw.source || 'web_discovery').slice(0, 32),
    });
    if (!parsed.ok) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }

    const result = await persistDiscoveryEvent(userId, parsed.event, {
      upsertSeriousTrope: wantsSeriousTrope,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json(
      { success: true, id: result.id, idempotent: result.idempotent },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    console.error('[DISCOVERY WEB EVENTS ERROR]', error);
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}
