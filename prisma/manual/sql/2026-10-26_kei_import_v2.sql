-- Import KEI v2: backoff błędów, heartbeat workera, ustawienia/filtry harmonogramu, limit dzienny,
-- stany nieudanych ogłoszeń, cykl życia źródła ofert, dzienne zużycie AI.
-- Tylko dodawanie. Idempotentne (sprawdzenie w information_schema — działa na MySQL i MariaDB).

SET @db := DATABASE();

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='KeiAutoImportSchedule' AND COLUMN_NAME='consecutiveErrors');
SET @sql := IF(@exists=0, 'ALTER TABLE `KeiAutoImportSchedule` ADD COLUMN `consecutiveErrors` INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='KeiAutoImportSchedule' AND COLUMN_NAME='lastErrorAt');
SET @sql := IF(@exists=0, 'ALTER TABLE `KeiAutoImportSchedule` ADD COLUMN `lastErrorAt` DATETIME(3) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='KeiAutoImportSchedule' AND COLUMN_NAME='lastStartedAt');
SET @sql := IF(@exists=0, 'ALTER TABLE `KeiAutoImportSchedule` ADD COLUMN `lastStartedAt` DATETIME(3) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='KeiAutoImportSchedule' AND COLUMN_NAME='workerHeartbeatAt');
SET @sql := IF(@exists=0, 'ALTER TABLE `KeiAutoImportSchedule` ADD COLUMN `workerHeartbeatAt` DATETIME(3) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='KeiAutoImportSchedule' AND COLUMN_NAME='settingsJson');
SET @sql := IF(@exists=0, 'ALTER TABLE `KeiAutoImportSchedule` ADD COLUMN `settingsJson` JSON NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='KeiAutoImportSchedule' AND COLUMN_NAME='dayKey');
SET @sql := IF(@exists=0, 'ALTER TABLE `KeiAutoImportSchedule` ADD COLUMN `dayKey` VARCHAR(10) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='KeiAutoImportSchedule' AND COLUMN_NAME='dayImportedCount');
SET @sql := IF(@exists=0, 'ALTER TABLE `KeiAutoImportSchedule` ADD COLUMN `dayImportedCount` INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='KeiAmerListingState' AND COLUMN_NAME='failCount');
SET @sql := IF(@exists=0, 'ALTER TABLE `KeiAmerListingState` ADD COLUMN `failCount` INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='KeiAmerListingState' AND COLUMN_NAME='lastFailAt');
SET @sql := IF(@exists=0, 'ALTER TABLE `KeiAmerListingState` ADD COLUMN `lastFailAt` DATETIME(3) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='KeiAmerListingState' AND COLUMN_NAME='lastFailReason');
SET @sql := IF(@exists=0, 'ALTER TABLE `KeiAmerListingState` ADD COLUMN `lastFailReason` VARCHAR(500) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='KeiAmerListingState' AND COLUMN_NAME='ignoredAt');
SET @sql := IF(@exists=0, 'ALTER TABLE `KeiAmerListingState` ADD COLUMN `ignoredAt` DATETIME(3) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='OfferPrivateNote' AND COLUMN_NAME='sourceInactiveStreak');
SET @sql := IF(@exists=0, 'ALTER TABLE `OfferPrivateNote` ADD COLUMN `sourceInactiveStreak` INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='OfferPrivateNote' AND COLUMN_NAME='sourceArchivedAt');
SET @sql := IF(@exists=0, 'ALTER TABLE `OfferPrivateNote` ADD COLUMN `sourceArchivedAt` DATETIME(3) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='KeiAutoImportSchedule' AND COLUMN_NAME='keiSessionCookie');
SET @sql := IF(@exists=0, 'ALTER TABLE `KeiAutoImportSchedule` ADD COLUMN `keiSessionCookie` TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='KeiAutoImportSchedule' AND COLUMN_NAME='keiSessionAt');
SET @sql := IF(@exists=0, 'ALTER TABLE `KeiAutoImportSchedule` ADD COLUMN `keiSessionAt` DATETIME(3) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `AiUsageDaily` (
  `day` VARCHAR(10) NOT NULL,
  `feature` VARCHAR(48) NOT NULL,
  `model` VARCHAR(64) NOT NULL,
  `calls` INT NOT NULL DEFAULT 0,
  `failures` INT NOT NULL DEFAULT 0,
  `inputTokens` BIGINT NOT NULL DEFAULT 0,
  `outputTokens` BIGINT NOT NULL DEFAULT 0,
  `costMicroUsd` BIGINT NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`day`, `feature`, `model`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='KeiAmerImportJob' AND INDEX_NAME='KeiAmerImportJob_status_createdAt_idx');
SET @sql := IF(@exists=0, 'CREATE INDEX `KeiAmerImportJob_status_createdAt_idx` ON `KeiAmerImportJob` (`status`, `createdAt`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='OfferPrivateNote' AND INDEX_NAME='OfferPrivateNote_importExternalUrl_idx');
SET @sql := IF(@exists=0, 'CREATE INDEX `OfferPrivateNote_importExternalUrl_idx` ON `OfferPrivateNote` (`importExternalUrl`(191))', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO `KeiAutoImportSchedule` (`id`) VALUES (1);
