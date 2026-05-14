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
      rawPayload LONGTEXT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY MobileIapPurchase_pending_key (pendingPurchaseId),
      KEY MobileIapPurchase_user_idx (userId),
      KEY MobileIapPurchase_transaction_idx (transactionId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}
