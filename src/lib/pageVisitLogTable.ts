import { prisma } from '@/lib/prisma';

const EXTRA_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'city', ddl: 'city VARCHAR(64) NULL' },
  { name: 'regionName', ddl: 'regionName VARCHAR(64) NULL' },
  { name: 'isp', ddl: 'isp VARCHAR(128) NULL' },
  { name: 'geoSource', ddl: "geoSource VARCHAR(16) NOT NULL DEFAULT 'unknown'" },
  { name: 'deviceType', ddl: "deviceType VARCHAR(16) NOT NULL DEFAULT 'unknown'" },
  { name: 'userId', ddl: 'userId INT NULL' },
];

export async function ensurePageVisitLogTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS PageVisitLog (
      id BIGINT NOT NULL AUTO_INCREMENT,
      visitorHash VARCHAR(64) NOT NULL,
      ip VARCHAR(64) NOT NULL,
      country VARCHAR(8) NOT NULL DEFAULT 'UN',
      path VARCHAR(191) NOT NULL DEFAULT '/',
      userAgent VARCHAR(255) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY PageVisitLog_path_createdAt_idx (path, createdAt),
      KEY PageVisitLog_hash_createdAt_idx (visitorHash, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  for (const column of EXTRA_COLUMNS) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE PageVisitLog ADD COLUMN ${column.ddl}`);
    } catch {
      // kolumna już istnieje
    }
  }

  try {
    await prisma.$executeRawUnsafe(`CREATE INDEX PageVisitLog_userId_createdAt_idx ON PageVisitLog (userId, createdAt)`);
  } catch {
    // indeks już istnieje
  }
}
