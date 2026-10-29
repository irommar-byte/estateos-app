-- Język panelu klienta (pl / en / uk) — wybierany przez klienta u góry panelu, zapamiętany do zmiany.
-- Tylko dodawanie. Idempotentne.
SET @db := DATABASE();

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='AgencyClient' AND COLUMN_NAME='portalLocale');
SET @sql := IF(@exists=0, 'ALTER TABLE `AgencyClient` ADD COLUMN `portalLocale` VARCHAR(5) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
