-- Additive JSON payload for open_house / auction proposals on ClientDecisionRequest.
-- MySQL 8+: ignore duplicate column errors on re-run via procedure-style guard if needed.

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ClientDecisionRequest'
    AND COLUMN_NAME = 'payload'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `ClientDecisionRequest` ADD COLUMN `payload` JSON NULL',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
