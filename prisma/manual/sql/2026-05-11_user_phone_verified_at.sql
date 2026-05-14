-- Oddzielne pole weryfikacji telefonu (SMS) — żeby nie mieszać z e-mail (isVerified/emailVerifiedAt).
-- Idempotent — safe to run multiple times.

ALTER TABLE `User`
  ADD COLUMN IF NOT EXISTS `phoneVerifiedAt` DATETIME(3) NULL;
