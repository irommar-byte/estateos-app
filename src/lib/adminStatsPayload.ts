import { prisma } from '@/lib/prisma';
import { serializeDbDateTime } from '@/lib/datetime/warsaw';

export async function getAdminStatsPayload() {
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
    where: { status: 'ACTIVE' },
  });

  const offersRaw = await prisma.offer.findMany({
    select: {
      price: true,
      area: true,
      district: true,
      createdAt: true,
      status: true,
      propertyType: true,
    },
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
    SELECT ip, country, path,
      DATE_FORMAT(createdAt, '%Y-%m-%dT%H:%i:%s') AS createdAt
    FROM PageVisitLog
    ORDER BY createdAt DESC
    LIMIT 5000
  `);

  const totalValue = offersRaw.reduce((acc, curr) => {
    const price = Number(String(curr.price || '0').replace(/\D/g, ''));
    return acc + (Number.isNaN(price) ? 0 : price);
  }, 0);

  const pageViews = visitsRaw.length;
  const uniqueViews = new Set(visitsRaw.map((v: any) => String(v.ip || ''))).size;

  return {
    kpis: {
      users: usersCount,
      offers: totalOffers,
      active: activeOffers,
      totalValue,
      pageViews,
      uniqueViews,
    },
    timeline: {
      offers: offersRaw,
      visits: visitsRaw.map((v: any) => ({
        ip: v.ip,
        country: v.country,
        path: v.path,
        createdAt: serializeDbDateTime(v.createdAt) ?? String(v.createdAt),
      })),
      users: usersTimelineRaw.map((u) => ({
        createdAt: serializeDbDateTime(u.createdAt) ?? String(u.createdAt),
        isBuyer: true,
        isSeller: true,
        role: u.role,
      })),
    },
  };
}
