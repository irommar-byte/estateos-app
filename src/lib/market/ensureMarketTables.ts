import { prisma } from '@/lib/prisma';

function ignorable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /already exists|Duplicate column|Duplicate key name/i.test(message);
}

async function hasUserColumn(columnName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ total: number | string | bigint }>>(
    `SELECT COUNT(*) AS total FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'User' AND column_name = ?`,
    columnName,
  );
  return Number(rows?.[0]?.total ?? 0) > 0;
}

export async function ensureMarketTables() {
  if (!(await hasUserColumn('marketReportCredits'))) {
    try {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE `User` ADD COLUMN `marketReportCredits` INTEGER NOT NULL DEFAULT 0',
      );
    } catch (error) {
      if (!ignorable(error)) throw error;
    }
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS MarketTransaction (
      id INTEGER NOT NULL AUTO_INCREMENT,
      gmlId VARCHAR(64) NOT NULL,
      sourceIip VARCHAR(64) NOT NULL,
      unitId VARCHAR(191) NULL,
      kind VARCHAR(16) NOT NULL DEFAULT 'LOCAL',
      teryt VARCHAR(16) NULL,
      city VARCHAR(96) NULL,
      district VARCHAR(96) NULL,
      street VARCHAR(191) NULL,
      address VARCHAR(255) NULL,
      lat DOUBLE NULL,
      lng DOUBLE NULL,
      deedAt DATETIME(3) NULL,
      marketType VARCHAR(24) NULL,
      transactionKind VARCHAR(48) NULL,
      share VARCHAR(24) NULL,
      shareRatio DOUBLE NULL,
      rooms INTEGER NULL,
      floor INTEGER NULL,
      areaM2 DOUBLE NULL,
      ancillaryM2 DOUBLE NULL,
      functionCode VARCHAR(48) NULL,
      priceGross DOUBLE NULL,
      vatAmount DOUBLE NULL,
      pricePerM2 DOUBLE NULL,
      qualityOk BOOLEAN NOT NULL DEFAULT false,
      qualityFlags VARCHAR(255) NULL,
      ingestedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY MarketTransaction_gmlId_key (gmlId),
      KEY MarketTransaction_kind_quality_deed_idx (kind, qualityOk, deedAt),
      KEY MarketTransaction_city_district_quality_deed_idx (city, district, qualityOk, deedAt),
      KEY MarketTransaction_lat_lng_idx (lat, lng),
      KEY MarketTransaction_pricePerM2_idx (pricePerM2),
      KEY MarketTransaction_sourceIip_idx (sourceIip)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS MarketAreaStat (
      id INTEGER NOT NULL AUTO_INCREMENT,
      city VARCHAR(96) NOT NULL,
      district VARCHAR(96) NOT NULL DEFAULT '',
      periodDays INTEGER NOT NULL,
      kind VARCHAR(16) NOT NULL DEFAULT 'LOCAL',
      marketType VARCHAR(24) NOT NULL DEFAULT 'all',
      txnCount INTEGER NOT NULL DEFAULT 0,
      avgPpsm DOUBLE NULL,
      medianPpsm DOUBLE NULL,
      p25Ppsm DOUBLE NULL,
      p75Ppsm DOUBLE NULL,
      yoyChangePct DOUBLE NULL,
      computedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY MarketAreaStat_scope_key (city, district, periodDays, kind, marketType),
      KEY MarketAreaStat_city_period_kind_idx (city, periodDays, kind)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS MarketIngestRun (
      id INTEGER NOT NULL AUTO_INCREMENT,
      status VARCHAR(24) NOT NULL,
      source VARCHAR(64) NOT NULL,
      startedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      finishedAt DATETIME(3) NULL,
      fetched INTEGER NOT NULL DEFAULT 0,
      upserted INTEGER NOT NULL DEFAULT 0,
      skipped INTEGER NOT NULL DEFAULT 0,
      error TEXT NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS MarketValuationReport (
      id INTEGER NOT NULL AUTO_INCREMENT,
      userId INTEGER NULL,
      email VARCHAR(191) NOT NULL,
      purpose VARCHAR(24) NOT NULL,
      creditUsed BOOLEAN NOT NULL DEFAULT false,
      subjectJson LONGTEXT NOT NULL,
      resultJson LONGTEXT NOT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY MarketValuationReport_email_createdAt_idx (email, createdAt),
      KEY MarketValuationReport_userId_createdAt_idx (userId, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS MarketValuationDraft (
      id INTEGER NOT NULL AUTO_INCREMENT,
      email VARCHAR(191) NOT NULL,
      userId INTEGER NULL,
      subjectJson LONGTEXT NOT NULL,
      listingPrice DOUBLE NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      consumedAt DATETIME(3) NULL,
      PRIMARY KEY (id),
      KEY MarketValuationDraft_email_idx (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}
