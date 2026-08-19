import { NextResponse } from 'next/server';
import { WARSAW_CITY } from '@/lib/market/constants';
import { ensureMarketTables } from '@/lib/market/ensureMarketTables';
import { buildMarketIntelligence } from '@/lib/market/aggregates';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await ensureMarketTables();
    const url = new URL(req.url);
    const city = url.searchParams.get('city') || WARSAW_CITY;
    const periodDays = Number(url.searchParams.get('periodDays') || 365);
    const payload = await buildMarketIntelligence(city, [30, 90, 180, 365, 730].includes(periodDays) ? periodDays : 365);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    console.error('[market.intelligence]', error);
    return NextResponse.json({ ok: false, message: 'Brak danych intelligence.' }, { status: 500 });
  }
}
