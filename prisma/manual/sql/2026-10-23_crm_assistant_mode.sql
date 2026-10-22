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

-- Po dodaniu kolumny (istniejące wiersze = AUTOPILOT) domyślna wartość dla nowych klientów to TRIAL.
ALTER TABLE `AgencyClient` ALTER COLUMN `intelligenceMode` SET DEFAULT 'TRIAL';

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'AgencyClient' AND COLUMN_NAME = 'salutation'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE `AgencyClient` ADD COLUMN `salutation` VARCHAR(8) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
