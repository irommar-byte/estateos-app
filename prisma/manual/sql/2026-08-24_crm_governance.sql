-- CRM ecosystem governance: PESEL hash, office review fields, MANAGER role
SET @db := DATABASE();

-- AgencyClient.peselHash
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'AgencyClient' AND COLUMN_NAME = 'peselHash'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `AgencyClient` ADD COLUMN `peselHash` VARCHAR(64) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'AgencyClient' AND INDEX_NAME = 'AgencyClient_peselHash_idx'
);
SET @sql := IF(@exists = 0,
  'CREATE INDEX `AgencyClient_peselHash_idx` ON `AgencyClient`(`peselHash`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'AgencyClient' AND INDEX_NAME = 'AgencyClient_status_updatedAt_idx'
);
SET @sql := IF(@exists = 0,
  'CREATE INDEX `AgencyClient_status_updatedAt_idx` ON `AgencyClient`(`status`, `updatedAt`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Offer office review columns
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND COLUMN_NAME = 'officeReviewStatus'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `Offer` ADD COLUMN `officeReviewStatus` VARCHAR(24) NOT NULL DEFAULT ''NONE''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND COLUMN_NAME = 'officeSubmittedAt'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `Offer` ADD COLUMN `officeSubmittedAt` DATETIME(3) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND COLUMN_NAME = 'officeReviewedAt'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `Offer` ADD COLUMN `officeReviewedAt` DATETIME(3) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND COLUMN_NAME = 'officeReviewedById'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `Offer` ADD COLUMN `officeReviewedById` INT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND COLUMN_NAME = 'officeReviewNote'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `Offer` ADD COLUMN `officeReviewNote` VARCHAR(512) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND INDEX_NAME = 'Offer_officeReviewStatus_officeSubmittedAt_idx'
);
SET @sql := IF(@exists = 0,
  'CREATE INDEX `Offer_officeReviewStatus_officeSubmittedAt_idx` ON `Offer`(`officeReviewStatus`, `officeSubmittedAt`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND INDEX_NAME = 'Offer_officeReviewedById_idx'
);
SET @sql := IF(@exists = 0,
  'CREATE INDEX `Offer_officeReviewedById_idx` ON `Offer`(`officeReviewedById`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- AgencyMemberRole: add MANAGER
ALTER TABLE `AgencyCompanyMember`
  MODIFY COLUMN `role` ENUM('ADMIN', 'MANAGER', 'AGENT') NOT NULL DEFAULT 'AGENT';
