-- Etap 1: jeden profil wyszukiwania — RadarPreference dostaje te same pola co AgencyClientBuyerPreference.
-- Tylko dodawanie. Idempotentne.
SET @db := DATABASE();

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='RadarPreference' AND COLUMN_NAME='maxArea');
SET @sql := IF(@exists=0, 'ALTER TABLE `RadarPreference` ADD COLUMN `maxArea` DOUBLE NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='RadarPreference' AND COLUMN_NAME='minRooms');
SET @sql := IF(@exists=0, 'ALTER TABLE `RadarPreference` ADD COLUMN `minRooms` INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='RadarPreference' AND COLUMN_NAME='maxRooms');
SET @sql := IF(@exists=0, 'ALTER TABLE `RadarPreference` ADD COLUMN `maxRooms` INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='RadarPreference' AND COLUMN_NAME='searchPolygon');
SET @sql := IF(@exists=0, 'ALTER TABLE `RadarPreference` ADD COLUMN `searchPolygon` JSON NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
