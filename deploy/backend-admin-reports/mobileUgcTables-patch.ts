/** Fragment do wklejenia w ~/estateos/src/lib/mobileUgcTables.ts (na końcu pliku). */

let adminReportColumnsReady = false;

export async function ensureAdminReportColumns() {
  if (adminReportColumnsReady) return;
  const cols = (await prisma.$queryRawUnsafe(`
    SELECT COLUMN_NAME AS name
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'MobileContentReport'
      AND COLUMN_NAME IN ('adminNote', 'reviewerId')
  `)) as Array<{ name: string }>;
  const have = new Set(cols.map((c) => String(c.name)));
  if (!have.has('adminNote')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE MobileContentReport ADD COLUMN adminNote TEXT NULL`);
  }
  if (!have.has('reviewerId')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE MobileContentReport ADD COLUMN reviewerId INT NULL`);
  }
  adminReportColumnsReady = true;
}
