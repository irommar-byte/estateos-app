-- Email change two-step verification + verified timestamp.
-- Idempotent — safe to run multiple times.

ALTER TABLE `User`
  ADD COLUMN IF NOT EXISTS `emailVerifiedAt` DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS `pendingEmail` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `pendingEmailCode` VARCHAR(16) NULL,
  ADD COLUMN IF NOT EXISTS `pendingEmailExpiresAt` DATETIME(3) NULL;

-- Backfill: dla użytkowników już oznaczonych jako zweryfikowani — ustaw znacznik czasu
UPDATE `User`
  SET `emailVerifiedAt` = COALESCE(`emailVerifiedAt`, `updatedAt`)
  WHERE `isVerified` = 1 AND `emailVerifiedAt` IS NULL;
