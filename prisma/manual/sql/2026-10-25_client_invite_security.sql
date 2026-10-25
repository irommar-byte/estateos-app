-- Kody wejścia klienta: długi klucz do linku w QR, ważność 6 cyfr, wspólny limit prób.
-- Tylko dodawanie. Idempotentne.
SET @db := DATABASE();

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='ClientInviteCode' AND COLUMN_NAME='linkKey');
SET @sql := IF(@exists=0, 'ALTER TABLE `ClientInviteCode` ADD COLUMN `linkKey` VARCHAR(40) NULL, ADD UNIQUE KEY `ClientInviteCode_linkKey_key` (`linkKey`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='ClientInviteCode' AND COLUMN_NAME='expiresAt');
SET @sql := IF(@exists=0, 'ALTER TABLE `ClientInviteCode` ADD COLUMN `expiresAt` DATETIME(3) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `ClientInviteAttempt` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `ipHash` CHAR(64) NOT NULL,
  `success` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ClientInviteAttempt_ipHash_createdAt_idx` (`ipHash`, `createdAt`),
  INDEX `ClientInviteAttempt_createdAt_idx` (`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
