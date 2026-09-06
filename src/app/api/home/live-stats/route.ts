import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureCarsStorage } from '@/lib/carsStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CACHE_SECONDS = 45;

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

    const [activeOffers, newOffers24h, cars] = await Promise.all([
      prisma.offer.count({ where: { status: 'ACTIVE' } }),
      prisma.offer.count({
        where: { status: 'ACTIVE', createdAt: { gte: dayAgo } },
      }),
      carMetrics(dayAgo),
    ]);

    return NextResponse.json(
      {
        success: true,
        updatedAt: now.toISOString(),
        metrics: {
          activeOffers,
          newOffers24h,
          activeCars: cars.activeCars,
          newCars24h: cars.newCars24h,
        },
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
        },
        error: message,
      },
      { status: 200 },
    );
  }
}
