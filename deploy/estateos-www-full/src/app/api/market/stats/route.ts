import { NextResponse } from 'next/server';
import { WARSAW_CITY } from '@/lib/market/constants';
import { ensureMarketTables } from '@/lib/market/ensureMarketTables';
import { getCityStats, getDistrictStats } from '@/lib/market/aggregates';
import { formatPlDate, rcnLagNote, resolveRcnAsOfDate } from '@/lib/market/asOf';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await ensureMarketTables();
    const url = new URL(req.url);
    const city = url.searchParams.get('city') || WARSAW_CITY;
    const periodDays = Number(url.searchParams.get('periodDays') || 365);
    const allowed = [30, 90, 180, 365, 730];
    const period = allowed.includes(periodDays) ? periodDays : 365;
    const [cityStat, districts, asOf] = await Promise.all([
      getCityStats(city, period),
      getDistrictStats(city, period),
      resolveRcnAsOfDate(city),
    ]);
    return NextResponse.json({
      ok: true,
      city,
      periodDays: period,
      cityStat,
      districts,
      asOf: asOf.toISOString(),
      asOfLabel: formatPlDate(asOf),
      lagNote: rcnLagNote(asOf, period),
      source: 'GUGiK — Rejestr Cen Nieruchomości',
    });
  } catch (error) {
    console.error('[market.stats]', error);
    return NextResponse.json({ ok: false, message: 'Brak statystyk rynku.' }, { status: 500 });
  }
}
