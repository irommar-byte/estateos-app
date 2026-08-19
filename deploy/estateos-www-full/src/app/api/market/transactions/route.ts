import { NextResponse } from 'next/server';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { prisma } from '@/lib/prisma';
import { ensureMarketTables } from '@/lib/market/ensureMarketTables';
import { canUseAgentMarket, loadMarketUser } from '@/lib/market/access';
import { MARKET_KIND_LOCAL, WARSAW_CITY } from '@/lib/market/constants';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await ensureMarketTables();
    const userId = await resolveWebUserId(req);
    if (!userId) return NextResponse.json({ ok: false, code: 'AUTH' }, { status: 401 });
    const user = await loadMarketUser(userId);
    if (!user || !canUseAgentMarket(user)) {
      return NextResponse.json({ ok: false, code: 'FORBIDDEN' }, { status: 403 });
    }

    const url = new URL(req.url);
    const latMin = Number(url.searchParams.get('latMin'));
    const latMax = Number(url.searchParams.get('latMax'));
    const lngMin = Number(url.searchParams.get('lngMin'));
    const lngMax = Number(url.searchParams.get('lngMax'));
    const days = Math.min(730, Math.max(30, Number(url.searchParams.get('days') || 365)));
    if (![latMin, latMax, lngMin, lngMax].every(Number.isFinite)) {
      return NextResponse.json({ ok: false, message: 'Podaj bbox.' }, { status: 422 });
    }

    const since = new Date(Date.now() - days * 86400000);
    const rows = await prisma.marketTransaction.findMany({
      where: {
        city: WARSAW_CITY,
        kind: MARKET_KIND_LOCAL,
        qualityOk: true,
        deedAt: { gte: since },
        lat: { gte: latMin, lte: latMax },
        lng: { gte: lngMin, lte: lngMax },
      },
      select: {
        id: true,
        lat: true,
        lng: true,
        priceGross: true,
        pricePerM2: true,
        areaM2: true,
        rooms: true,
        floor: true,
        deedAt: true,
        district: true,
        address: true,
        marketType: true,
      },
      take: 400,
      orderBy: { deedAt: 'desc' },
    });

    return NextResponse.json({
      ok: true,
      transactions: rows.map((r) => ({
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        price: r.priceGross,
        ppsm: r.pricePerM2 != null ? Math.round(r.pricePerM2) : null,
        area: r.areaM2,
        rooms: r.rooms,
        floor: r.floor,
        deedAt: r.deedAt?.toISOString().slice(0, 10) ?? null,
        district: r.district,
        address: r.address,
        marketType: r.marketType,
      })),
    });
  } catch (error) {
    console.error('[market.transactions]', error);
    return NextResponse.json({ ok: false, message: 'Nie udało się pobrać transakcji.' }, { status: 500 });
  }
}
