import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS CarEngagement (
      carId INT NOT NULL,
      viewsCount INT NOT NULL DEFAULT 0,
      favoritesCount INT NOT NULL DEFAULT 0,
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (carId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

/** delta: +1 when favorited, -1 when removed (floor at 0). */
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: raw } = await context.params;
    const carId = Number(raw);
    if (!Number.isFinite(carId) || carId <= 0) {
      return NextResponse.json({ success: false, message: 'Bad id' }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const delta = Number(body?.delta) === -1 ? -1 : 1;
    await ensureTable();
    if (delta > 0) {
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO CarEngagement (carId, viewsCount, favoritesCount)
          VALUES (?, 0, 1)
          ON DUPLICATE KEY UPDATE favoritesCount = favoritesCount + 1
        `,
        carId,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO CarEngagement (carId, viewsCount, favoritesCount)
          VALUES (?, 0, 0)
          ON DUPLICATE KEY UPDATE favoritesCount = GREATEST(favoritesCount - 1, 0)
        `,
        carId,
      );
    }
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT viewsCount, favoritesCount FROM CarEngagement WHERE carId = ?`,
      carId,
    )) as Array<{ viewsCount: number; favoritesCount: number }>;
    return NextResponse.json({
      success: true,
      viewsCount: Number(rows?.[0]?.viewsCount || 0),
      favoritesCount: Number(rows?.[0]?.favoritesCount || 0),
    });
  } catch (error) {
    console.error('car favorite-count error', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
