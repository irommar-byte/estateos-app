-- EstateOS™ Intelligence assistant for agency clients
SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'AgencyClient' AND COLUMN_NAME = 'intelligenceEnabled'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `AgencyClient` ADD COLUMN `intelligenceEnabled` BOOLEAN NOT NULL DEFAULT false',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'AgencyClient' AND COLUMN_NAME = 'intelligenceIntervalHours'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `AgencyClient` ADD COLUMN `intelligenceIntervalHours` INT NOT NULL DEFAULT 24',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'AgencyClient' AND COLUMN_NAME = 'intelligenceDailyLimit'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `AgencyClient` ADD COLUMN `intelligenceDailyLimit` INT NOT NULL DEFAULT 1',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'AgencyClient' AND COLUMN_NAME = 'intelligenceMinLearns'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `AgencyClient` ADD COLUMN `intelligenceMinLearns` INT NOT NULL DEFAULT 3',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'AgencyClient' AND COLUMN_NAME = 'intelligenceMinScore'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `AgencyClient` ADD COLUMN `intelligenceMinScore` INT NOT NULL DEFAULT 92',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'AgencyClient' AND COLUMN_NAME = 'intelligenceLastSentAt'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `AgencyClient` ADD COLUMN `intelligenceLastSentAt` DATETIME(3) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'AgencyClientMatch' AND COLUMN_NAME = 'intelligenceSent'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `AgencyClientMatch` ADD COLUMN `intelligenceSent` BOOLEAN NOT NULL DEFAULT false',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'AgencyClientMatch' AND COLUMN_NAME = 'intelligenceReason'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `AgencyClientMatch` ADD COLUMN `intelligenceReason` TEXT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
