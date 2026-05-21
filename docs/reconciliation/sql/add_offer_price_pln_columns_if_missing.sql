-- Idempotent: Offer.priceCurrency, pricePln, exchangeRateUsed, exchangeRateDate (EUR/PLN).
SET @db := DATABASE();

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND COLUMN_NAME = 'priceCurrency');
SET @sql := IF(@c = 0, 'ALTER TABLE `Offer` ADD COLUMN `priceCurrency` VARCHAR(8) NOT NULL DEFAULT ''PLN'' AFTER `price`', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND COLUMN_NAME = 'pricePln');
SET @sql := IF(@c = 0, 'ALTER TABLE `Offer` ADD COLUMN `pricePln` DOUBLE NULL AFTER `priceCurrency`', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND COLUMN_NAME = 'exchangeRateUsed');
SET @sql := IF(@c = 0, 'ALTER TABLE `Offer` ADD COLUMN `exchangeRateUsed` DOUBLE NULL AFTER `pricePln`', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND COLUMN_NAME = 'exchangeRateDate');
SET @sql := IF(@c = 0, 'ALTER TABLE `Offer` ADD COLUMN `exchangeRateDate` DATE NULL AFTER `exchangeRateUsed`', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE `Offer`
SET `priceCurrency` = 'PLN',
    `pricePln` = `price`
WHERE `pricePln` IS NULL
   OR `priceCurrency` IS NULL
   OR TRIM(`priceCurrency`) = '';
