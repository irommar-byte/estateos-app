import { prisma } from '@/lib/prisma';

export async function ensureMobileIapTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS MobileIapPurchase (
      id BIGINT NOT NULL AUTO_INCREMENT,
      userId INT NOT NULL,
      pendingPurchaseId VARCHAR(191) NOT NULL,
      platform VARCHAR(24) NOT NULL DEFAULT 'ios',
      productId VARCHAR(191) NOT NULL,
      transactionId VARCHAR(191) NULL,
      originalTransactionId VARCHAR(191) NULL,
      receipt TEXT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'VERIFIED',
      entitlementGrantedAt DATETIME(3) NULL,
      rawPayload LONGTEXT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY MobileIapPurchase_pending_key (pendingPurchaseId),
      KEY MobileIapPurchase_user_idx (userId),
      KEY MobileIapPurchase_transaction_idx (transactionId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await ensureMobileIapEntitlementGrantedColumn();
  await ensureMobileIapPublicationColumns();
  await ensureUserPlusEntitlementColumns();
}

function isIgnorableSchemaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Duplicate column name|already exists/i.test(message);
}

function isIfNotExistsSyntaxError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /syntax/i.test(message) && /if not exists/i.test(message);
}

async function hasUserColumn(columnName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ total: number | string | bigint }>>(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'User'
        AND column_name = ?
    `,
    columnName
  );
  return Number(rows?.[0]?.total ?? 0) > 0;
}

async function hasMobileIapColumn(columnName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ total: number | string | bigint }>>(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'MobileIapPurchase'
        AND column_name = ?
    `,
    columnName
  );
  return Number(rows?.[0]?.total ?? 0) > 0;
}

export async function ensureMobileIapEntitlementGrantedColumn() {
  if (await hasMobileIapColumn('entitlementGrantedAt')) return;
  try {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `MobileIapPurchase` ADD COLUMN IF NOT EXISTS `entitlementGrantedAt` DATETIME(3) NULL AFTER `status`"
    );
  } catch (error) {
    if (isIgnorableSchemaError(error)) return;
    if (!isIfNotExistsSyntaxError(error)) throw error;
    if (!(await hasMobileIapColumn('entitlementGrantedAt'))) {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `MobileIapPurchase` ADD COLUMN `entitlementGrantedAt` DATETIME(3) NULL AFTER `status`"
      );
    }
  }
}

async function ensureMobileIapColumn(columnName: string, definition: string) {
  if (await hasMobileIapColumn(columnName)) return;
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`MobileIapPurchase\` ADD COLUMN IF NOT EXISTS \`${columnName}\` ${definition}`
    );
  } catch (error) {
    if (isIgnorableSchemaError(error)) return;
    if (!isIfNotExistsSyntaxError(error)) throw error;
    if (!(await hasMobileIapColumn(columnName))) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE \`MobileIapPurchase\` ADD COLUMN \`${columnName}\` ${definition}`
      );
    }
  }
}

async function ensureMobileIapIndex(indexName: string, sql: string) {
  const existing = await prisma.$queryRawUnsafe<Array<{ total: number | string | bigint }>>(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'MobileIapPurchase'
        AND index_name = ?
    `,
    indexName
  );
  if (Number(existing?.[0]?.total ?? 0) > 0) return;
  await prisma.$executeRawUnsafe(sql);
}

export async function ensureMobileIapPublicationColumns() {
  await ensureMobileIapColumn('verifyStatus', "VARCHAR(24) NOT NULL DEFAULT 'VERIFIED'");
  await ensureMobileIapColumn('targetOfferId', 'INT NULL');
  await ensureMobileIapColumn('offerId', 'INT NULL');
  await ensureMobileIapColumn('consumedAt', 'DATETIME(3) NULL');

  await ensureMobileIapIndex(
    'MobileIapPurchase_verify_status_idx',
    'CREATE INDEX MobileIapPurchase_verify_status_idx ON `MobileIapPurchase` (`verifyStatus`)'
  );
  await ensureMobileIapIndex(
    'MobileIapPurchase_consumed_at_idx',
    'CREATE INDEX MobileIapPurchase_consumed_at_idx ON `MobileIapPurchase` (`consumedAt`)'
  );
}

export async function ensureUserPlusEntitlementColumns() {
  if (!(await hasUserColumn('plusExpiresAt'))) {
    try {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `User` ADD COLUMN IF NOT EXISTS `plusExpiresAt` DATETIME(3) NULL"
      );
    } catch (error) {
      if (isIgnorableSchemaError(error)) {
        // no-op
      } else if (isIfNotExistsSyntaxError(error)) {
        if (!(await hasUserColumn('plusExpiresAt'))) {
          await prisma.$executeRawUnsafe("ALTER TABLE `User` ADD COLUMN `plusExpiresAt` DATETIME(3) NULL");
        }
      } else {
        throw error;
      }
    }
  }

  await prisma.$executeRawUnsafe(
    "ALTER TABLE `User` MODIFY COLUMN `planType` ENUM('NONE','PRO','PLUS','AGENCY','INVESTOR') NULL DEFAULT 'NONE'"
  );
}
