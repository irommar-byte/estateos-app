-- EstateOS™ Inteligence account preference (WWW + mobile sync)
ALTER TABLE `User`
  ADD COLUMN `intelligenceEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `intelligenceDecidedAt` DATETIME(3) NULL;
