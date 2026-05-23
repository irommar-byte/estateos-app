import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';

async function requireAdmin() {
  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get('estateos_session')?.value ||
    cookieStore.get('luxestate_user')?.value ||
    null;
  if (!sessionToken) return null;

  const session = decryptSession(sessionToken);
  const email = String(session?.email || '').trim().toLowerCase();
  if (!email) return null;

  return prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS PageVisitLog (
        id BIGINT NOT NULL AUTO_INCREMENT,
        visitorHash VARCHAR(64) NOT NULL,
        ip VARCHAR(64) NOT NULL,
        country VARCHAR(8) NOT NULL DEFAULT 'PL',
        path VARCHAR(191) NOT NULL DEFAULT '/',
        userAgent VARCHAR(255) NULL,
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY PageVisitLog_path_createdAt_idx (path, createdAt),
        KEY PageVisitLog_hash_createdAt_idx (visitorHash, createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const usersCount = await prisma.user.count();
    const totalOffers = await prisma.offer.count();
    const activeOffers = await prisma.offer.count({
      where: { status: 'ACTIVE' }
    });

    const offersRaw = await prisma.offer.findMany({
      select: {
        price: true,
        area: true,
        district: true,
        createdAt: true,
        status: true,
        propertyType: true
      }
    });

    const usersTimelineRaw = await prisma.user.findMany({
      select: {
        createdAt: true,
        role: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const visitsRaw = await prisma.$queryRawUnsafe<any[]>(`
      SELECT ip, country, path, createdAt
      FROM PageVisitLog
      ORDER BY createdAt DESC
      LIMIT 5000
    `);

    // BEZPIECZNE LICZENIE
    const totalValue = offersRaw.reduce((acc, curr) => {
      const price = Number(String(curr.price || "0").replace(/\D/g, ""));
      return acc + (isNaN(price) ? 0 : price);
    }, 0);

    const pageViews = visitsRaw.length;
    const uniqueViews = new Set(visitsRaw.map((v: any) => String(v.ip || ''))).size;

    return NextResponse.json({
      kpis: {
        users: usersCount,
        offers: totalOffers,
        active: activeOffers,
        totalValue,
        pageViews,
        uniqueViews
      },
      timeline: {
        offers: offersRaw,
        visits: visitsRaw,
        users: usersTimelineRaw.map((u) => ({
          createdAt: u.createdAt,
          // W obecnym modelu user jest jednocześnie buyer + seller.
          isBuyer: true,
          isSeller: true,
          role: u.role
        }))
      }
    });

  } catch (error) {
    console.error("STATS ERROR:", error);
    return NextResponse.json({ error: "Błąd obliczeń" }, { status: 500 });
  }
}
