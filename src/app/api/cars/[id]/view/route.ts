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

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: raw } = await context.params;
    const carId = Number(raw);
    if (!Number.isFinite(carId) || carId <= 0) {
      return NextResponse.json({ success: false, message: 'Bad id' }, { status: 400 });
    }
    await ensureTable();
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO CarEngagement (carId, viewsCount, favoritesCount)
        VALUES (?, 1, 0)
        ON DUPLICATE KEY UPDATE viewsCount = viewsCount + 1
      `,
      carId,
    );
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT viewsCount, favoritesCount FROM CarEngagement WHERE carId = ?`,
      carId,
    )) as Array<{ viewsCount: number; favoritesCount: number }>;
    return NextResponse.json({
      success: true,
      viewsCount: Number(rows?.[0]?.viewsCount || 1),
      favoritesCount: Number(rows?.[0]?.favoritesCount || 0),
    });
  } catch (error) {
    console.error('car view error', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
