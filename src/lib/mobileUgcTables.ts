import { prisma } from '@/lib/prisma';

export async function ensureMobileUgcTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS MobileUserBlock (
      id BIGINT NOT NULL AUTO_INCREMENT,
      blockerUserId INT NOT NULL,
      blockedUserId INT NOT NULL,
      reason VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY MobileUserBlock_blocker_blocked_key (blockerUserId, blockedUserId),
      KEY MobileUserBlock_blocker_idx (blockerUserId),
      KEY MobileUserBlock_blocked_idx (blockedUserId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS MobileContentReport (
      id BIGINT NOT NULL AUTO_INCREMENT,
      reporterUserId INT NOT NULL,
      targetType VARCHAR(32) NOT NULL,
      targetId VARCHAR(191) NULL,
      reportedUserId INT NULL,
      category VARCHAR(64) NOT NULL DEFAULT 'OTHER',
      reason TEXT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY MobileContentReport_reporter_idx (reporterUserId),
      KEY MobileContentReport_target_idx (targetType, targetId),
      KEY MobileContentReport_status_idx (status, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}
