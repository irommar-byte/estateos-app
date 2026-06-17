-- Zarządzanie ofertą przez agencję — uruchom przed deployem.
-- npx prisma db execute --file prisma/manual/sql/2026-06-17_offer_agency_management.sql --schema prisma/schema.prisma

ALTER TABLE `Offer`
  ADD COLUMN `originalOwnerUserId` INT NULL,
  ADD COLUMN `managementStatus` VARCHAR(24) NOT NULL DEFAULT 'SELF',
  ADD INDEX `Offer_originalOwnerUserId_idx` (`originalOwnerUserId`),
  ADD CONSTRAINT `Offer_originalOwnerUserId_fkey`
    FOREIGN KEY (`originalOwnerUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
