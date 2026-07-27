-- EstateOS Inteligence account preference (WWW + mobile sync)
-- Idempotent: skip columns that already exist.

SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'User' AND COLUMN_NAME = 'intelligenceEnabled'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `User` ADD COLUMN `intelligenceEnabled` BOOLEAN NOT NULL DEFAULT false',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'User' AND COLUMN_NAME = 'intelligenceDecidedAt'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `User` ADD COLUMN `intelligenceDecidedAt` DATETIME(3) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
