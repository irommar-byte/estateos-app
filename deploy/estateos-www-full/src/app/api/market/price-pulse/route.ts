import { NextResponse } from 'next/server';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { canUseAgentMarket, loadMarketUser } from '@/lib/market/access';
import { hitRateLimit } from '@/lib/market/rateLimit';
import { buildPricePulse } from '@/lib/market/pricePulse';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const userId = await resolveWebUserId(req);
    if (!userId) {
      return NextResponse.json({ ok: false, code: 'AUTH', message: 'Zaloguj się.' }, { status: 401 });
    }
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'ip';
    if (hitRateLimit(`price-pulse:${userId || ip}`, 40, 10 * 60 * 1000)) {
      return NextResponse.json(
        { ok: false, code: 'RATE', message: 'Zbyt wiele zapytań. Poczekaj chwilę.' },
        { status: 429 },
      );
    }
    const user = await loadMarketUser(userId);
    if (!user || !canUseAgentMarket(user)) {
      return NextResponse.json(
        {
          ok: false,
          code: 'PRO_REQUIRED',
          message: 'Puls cenowy jest dostępny w CRM Pro oraz dla biur.',
        },
        { status: 403 },
      );
    }
    const payload = await buildPricePulse();
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[market.price-pulse]', error);
    return NextResponse.json({ ok: false, message: 'Brak pulsu cenowego.' }, { status: 500 });
  }
}
