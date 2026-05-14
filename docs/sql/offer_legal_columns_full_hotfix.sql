-- Runtime-safe hotfix for legacy production schemas missing legal Offer columns.
-- Designed for MySQL 8+ (ADD COLUMN IF NOT EXISTS).

ALTER TABLE `Offer`
  ADD COLUMN IF NOT EXISTS `landRegistryNumber` VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS `apartmentNumber` VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS `legalCheckStatus` VARCHAR(16) NULL,
  ADD COLUMN IF NOT EXISTS `legalCheckSubmittedAt` DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS `legalCheckReviewedAt` DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS `legalCheckReviewedBy` INT NULL,
  ADD COLUMN IF NOT EXISTS `legalCheckRejectionReason` VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS `legalCheckRejectionText` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `legalCheckOwnerNote` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `isLegalSafeVerified` BOOLEAN NULL;

-- Backfill for legacy rows so Prisma non-null mappings don't throw conversion errors.
UPDATE `Offer`
SET `legalCheckStatus` = 'NONE'
WHERE `legalCheckStatus` IS NULL OR TRIM(`legalCheckStatus`) = '';

UPDATE `Offer`
SET `isLegalSafeVerified` = 0
WHERE `isLegalSafeVerified` IS NULL;
