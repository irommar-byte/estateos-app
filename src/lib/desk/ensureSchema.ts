import { prisma } from '@/lib/prisma';

let ensured = false;
let ensurePromise: Promise<void> | null = null;

export async function ensureDeskSchema() {
  if (ensured) return;
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`DeskCase\` (
        \`id\` INTEGER NOT NULL AUTO_INCREMENT,
        \`agencyUserId\` INTEGER NOT NULL,
        \`clientId\` INTEGER NOT NULL,
        \`kind\` VARCHAR(8) NOT NULL,
        \`pipelineStage\` VARCHAR(32) NOT NULL,
        \`source\` VARCHAR(64) NULL,
        \`sourceUrl\` VARCHAR(1024) NULL,
        \`propertySnapshot\` JSON NULL,
        \`linkedOfferId\` INTEGER NULL,
        \`linkedDealId\` INTEGER NULL,
        \`linkedAcquisitionId\` INTEGER NULL,
        \`nextAction\` VARCHAR(255) NULL,
        \`nextActionAt\` DATETIME(3) NULL,
        \`temperature\` VARCHAR(8) NOT NULL DEFAULT 'WARM',
        \`health\` VARCHAR(16) NOT NULL DEFAULT 'HEALTHY',
        \`lastContactedAt\` DATETIME(3) NULL,
        \`contractEndsAt\` DATETIME(3) NULL,
        \`lostReason\` VARCHAR(255) NULL,
        \`title\` VARCHAR(255) NULL,
        \`metadata\` JSON NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`DeskCase_agencyUserId_kind_pipelineStage_idx\` (\`agencyUserId\`, \`kind\`, \`pipelineStage\`),
        KEY \`DeskCase_agencyUserId_nextActionAt_idx\` (\`agencyUserId\`, \`nextActionAt\`),
        KEY \`DeskCase_agencyUserId_health_temperature_idx\` (\`agencyUserId\`, \`health\`, \`temperature\`),
        KEY \`DeskCase_clientId_idx\` (\`clientId\`),
        KEY \`DeskCase_linkedOfferId_idx\` (\`linkedOfferId\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`DeskTask\` (
        \`id\` INTEGER NOT NULL AUTO_INCREMENT,
        \`agencyUserId\` INTEGER NOT NULL,
        \`caseId\` INTEGER NULL,
        \`clientId\` INTEGER NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`status\` VARCHAR(16) NOT NULL DEFAULT 'OPEN',
        \`priority\` VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
        \`dueAt\` DATETIME(3) NULL,
        \`trigger\` VARCHAR(64) NULL,
        \`completedAt\` DATETIME(3) NULL,
        \`metadata\` JSON NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`DeskTask_agencyUserId_status_dueAt_idx\` (\`agencyUserId\`, \`status\`, \`dueAt\`),
        KEY \`DeskTask_caseId_status_idx\` (\`caseId\`, \`status\`),
        KEY \`DeskTask_clientId_idx\` (\`clientId\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    ensured = true;
  })().finally(() => {
    ensurePromise = null;
  });
  return ensurePromise;
}
