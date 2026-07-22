import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureCarsStorage } from '@/lib/carsStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CACHE_SECONDS = 45;

function parsePrice(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number.parseFloat(String(value ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

async function carMetrics(dayAgo: Date): Promise<{ activeCars: number; newCars24h: number }> {
  try {
    await ensureCarsStorage();
    const [activeRows, newRows] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ c: number | bigint }>>(`SELECT COUNT(*) AS c FROM CarListing`),
      prisma.$queryRawUnsafe<Array<{ c: number | bigint }>>(
        `SELECT COUNT(*) AS c FROM CarListing WHERE createdAt >= ?`,
        dayAgo,
      ),
    ]);
    return {
      activeCars: Number(activeRows[0]?.c || 0),
      newCars24h: Number(newRows[0]?.c || 0),
    };
  } catch {
    return { activeCars: 0, newCars24h: 0 };
  }
}

export async function GET() {
  try {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [activeOffers, newOffers24h, citiesRaw, usersTotal, recentOffers, flats, cars] =
      await Promise.all([
        prisma.offer.count({ where: { status: 'ACTIVE' } }),
        prisma.offer.count({
          where: { status: 'ACTIVE', createdAt: { gte: dayAgo } },
        }),
        prisma.offer.groupBy({
          by: ['city'],
          where: { status: 'ACTIVE' },
        }),
        prisma.user.count(),
        prisma.offer.findMany({
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: {
            id: true,
            city: true,
            propertyType: true,
            transactionType: true,
            createdAt: true,
          },
        }),
        prisma.offer.findMany({
          where: {
            status: 'ACTIVE',
            propertyType: 'FLAT',
            area: { gt: 0 },
          },
          select: { price: true, area: true },
          take: 500,
        }),
        carMetrics(dayAgo),
      ]);

    let totalPrice = 0;
    let totalArea = 0;
    for (const o of flats) {
      const p = parsePrice(o.price);
      const a = parsePrice(o.area);
      if (p > 0 && a > 0) {
        totalPrice += p;
        totalArea += a;
      }
    }
    const avgPricePerSqm = totalArea > 0 ? Math.round(totalPrice / totalArea) : null;

    const cities = citiesRaw.map((c) => c.city).filter(Boolean);
    const marketCities = cities.length;

    const ticker = recentOffers.map((o) => ({
      id: o.id,
      city: o.city,
      propertyType: o.propertyType,
      transactionType: o.transactionType,
      at: o.createdAt.toISOString(),
    }));

    return NextResponse.json(
      {
        success: true,
        updatedAt: now.toISOString(),
        metrics: {
          activeOffers,
          newOffers24h,
          activeCars: cars.activeCars,
          newCars24h: cars.newCars24h,
          marketCities,
          avgPricePerSqm,
          registeredMembers: usersTotal,
        },
        ticker,
      },
      {
        headers: {
          'Cache-Control': `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=120`,
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        updatedAt: new Date().toISOString(),
        metrics: {
          activeOffers: 0,
          newOffers24h: 0,
          activeCars: 0,
          newCars24h: 0,
          marketCities: 0,
          avgPricePerSqm: null,
          registeredMembers: 0,
        },
        ticker: [
          {
            id: 0,
            city: null,
            propertyType: null,
            transactionType: null,
            at: new Date().toISOString(),
          },
        ],
        error: message,
      },
      { status: 200 },
    );
  }
}
