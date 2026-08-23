-- Padlocks for EstateOS™ Intelligence: which buyer survey fields the assistant may rewrite.
SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'AgencyClient' AND COLUMN_NAME = 'intelligenceLockedFields'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `AgencyClient` ADD COLUMN `intelligenceLockedFields` JSON NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
