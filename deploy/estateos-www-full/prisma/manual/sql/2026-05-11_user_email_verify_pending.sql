-- Verify CURRENT email (osobny tor od zmiany adresu).
-- Idempotent — safe to run multiple times.

ALTER TABLE `User`
  ADD COLUMN IF NOT EXISTS `emailVerifyCode` VARCHAR(16) NULL,
  ADD COLUMN IF NOT EXISTS `emailVerifyExpiresAt` DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS `emailVerifiedAt` DATETIME(3) NULL;

UPDATE `User`
  SET `emailVerifiedAt` = COALESCE(`emailVerifiedAt`, `updatedAt`)
  WHERE `isVerified` = 1 AND `emailVerifiedAt` IS NULL;
