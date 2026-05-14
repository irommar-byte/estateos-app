-- Idempotentne dodanie kolumn prawnych / KW na `Offer` (MySQL 8+).
-- Uruchom: `npx prisma db execute --file docs/reconciliation/sql/add_offer_land_registry_and_legal_columns_if_missing.sql`
-- Bezpieczne wielokrotnie: jeśli kolumna już jest, wykonuje się `SELECT 1`.

SET @db := DATABASE();

-- landRegistryNumber
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND COLUMN_NAME = 'landRegistryNumber');
SET @sql := IF(@c = 0, 'ALTER TABLE `Offer` ADD COLUMN `landRegistryNumber` VARCHAR(64) NULL', 'SELECT 1');
PREPARE s FROM @sql;
EXECUTE s;
DEALLOCATE PREPARE s;

-- apartmentNumber
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND COLUMN_NAME = 'apartmentNumber');
SET @sql := IF(@c = 0, 'ALTER TABLE `Offer` ADD COLUMN `apartmentNumber` VARCHAR(64) NULL', 'SELECT 1');
PREPARE s FROM @sql;
EXECUTE s;
DEALLOCATE PREPARE s;

-- legalCheckStatus
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND COLUMN_NAME = 'legalCheckStatus');
SET @sql := IF(@c = 0, 'ALTER TABLE `Offer` ADD COLUMN `legalCheckStatus` VARCHAR(16) NOT NULL DEFAULT ''NONE''', 'SELECT 1');
PREPARE s FROM @sql;
EXECUTE s;
DEALLOCATE PREPARE s;

-- legalCheckSubmittedAt
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND COLUMN_NAME = 'legalCheckSubmittedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `Offer` ADD COLUMN `legalCheckSubmittedAt` DATETIME(3) NULL', 'SELECT 1');
PREPARE s FROM @sql;
EXECUTE s;
DEALLOCATE PREPARE s;

-- legalCheckReviewedAt
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND COLUMN_NAME = 'legalCheckReviewedAt');
SET @sql := IF(@c = 0, 'ALTER TABLE `Offer` ADD COLUMN `legalCheckReviewedAt` DATETIME(3) NULL', 'SELECT 1');
PREPARE s FROM @sql;
EXECUTE s;
DEALLOCATE PREPARE s;

-- legalCheckReviewedBy
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND COLUMN_NAME = 'legalCheckReviewedBy');
SET @sql := IF(@c = 0, 'ALTER TABLE `Offer` ADD COLUMN `legalCheckReviewedBy` INT NULL', 'SELECT 1');
PREPARE s FROM @sql;
EXECUTE s;
DEALLOCATE PREPARE s;

-- legalCheckRejectionReason
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND COLUMN_NAME = 'legalCheckRejectionReason');
SET @sql := IF(@c = 0, 'ALTER TABLE `Offer` ADD COLUMN `legalCheckRejectionReason` VARCHAR(64) NULL', 'SELECT 1');
PREPARE s FROM @sql;
EXECUTE s;
DEALLOCATE PREPARE s;

-- legalCheckRejectionText
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND COLUMN_NAME = 'legalCheckRejectionText');
SET @sql := IF(@c = 0, 'ALTER TABLE `Offer` ADD COLUMN `legalCheckRejectionText` TEXT NULL', 'SELECT 1');
PREPARE s FROM @sql;
EXECUTE s;
DEALLOCATE PREPARE s;

-- legalCheckOwnerNote
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND COLUMN_NAME = 'legalCheckOwnerNote');
SET @sql := IF(@c = 0, 'ALTER TABLE `Offer` ADD COLUMN `legalCheckOwnerNote` TEXT NULL', 'SELECT 1');
PREPARE s FROM @sql;
EXECUTE s;
DEALLOCATE PREPARE s;

-- isLegalSafeVerified
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Offer' AND COLUMN_NAME = 'isLegalSafeVerified');
SET @sql := IF(@c = 0, 'ALTER TABLE `Offer` ADD COLUMN `isLegalSafeVerified` TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE s FROM @sql;
EXECUTE s;
DEALLOCATE PREPARE s;
