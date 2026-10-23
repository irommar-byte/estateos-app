-- CRM 2.0: tryb asystenta (akceptacja / autopilot) i forma grzecznościowa klienta.
-- Tylko dodawanie kolumn. Idempotentne (MySQL: sprawdzenie w information_schema).
-- Istniejący klienci dostają AUTOPILOT (bez zmiany zachowania); nowi — TRIAL (7 dni z akceptacją).

SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'AgencyClient' AND COLUMN_NAME = 'intelligenceMode'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `AgencyClient` ADD COLUMN `intelligenceMode` VARCHAR(16) NOT NULL DEFAULT ''AUTOPILOT''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Nowi klienci: każda propozycja asystenta czeka na akceptację agenta.
ALTER TABLE `AgencyClient` ALTER COLUMN `intelligenceMode` SET DEFAULT 'APPROVAL';

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'AgencyClient' AND COLUMN_NAME = 'salutation'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `AgencyClient` ADD COLUMN `salutation` VARCHAR(8) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── Kolejka „Do wysłania”: nic nie wychodzi do klienta bez akceptacji agenta ──────────

SET @firstOutbox := (
  SELECT COUNT(*) = 0 FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'CrmOutbox'
);

CREATE TABLE IF NOT EXISTS `CrmOutbox` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `agencyUserId` INTEGER NOT NULL,
  `clientId` INTEGER NOT NULL,
  `category` VARCHAR(32) NOT NULL,
  `source` VARCHAR(64) NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
  `channels` VARCHAR(64) NOT NULL DEFAULT '',
  `recipient` VARCHAR(191) NULL,
  `subject` VARCHAR(255) NULL,
  `previewText` TEXT NULL,
  `previewHtml` MEDIUMTEXT NULL,
  `steps` JSON NOT NULL,
  `error` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `decidedAt` DATETIME(3) NULL,
  `decidedBy` INTEGER NULL,
  `sentAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `CrmOutbox_agencyUserId_status_createdAt_idx` (`agencyUserId`, `status`, `createdAt`),
  KEY `CrmOutbox_clientId_status_idx` (`clientId`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'AgencyClient' AND COLUMN_NAME = 'autoSendCategories'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `AgencyClient` ADD COLUMN `autoSendCategories` JSON NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Jednorazowo, przy pierwszym utworzeniu kolejki: wszyscy klienci przechodzą na akceptację.
-- (Przy kolejnych wdrożeniach nie ruszamy wyborów agenta.)
SET @sql := IF(@firstOutbox = 1,
  'UPDATE `AgencyClient` SET `intelligenceMode` = ''APPROVAL'' WHERE `intelligenceMode` IN (''TRIAL'', ''AUTOPILOT'')',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
