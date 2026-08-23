-- Inteligentne dodawanie: przełącznik importera + ślad na ofercie
SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'User' AND COLUMN_NAME = 'intelligenceSmartAddEnabled'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `User` ADD COLUMN `intelligenceSmartAddEnabled` BOOLEAN NOT NULL DEFAULT false',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND COLUMN_NAME = 'intelligenceAmenityPatches'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `Offer` ADD COLUMN `intelligenceAmenityPatches` JSON NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
