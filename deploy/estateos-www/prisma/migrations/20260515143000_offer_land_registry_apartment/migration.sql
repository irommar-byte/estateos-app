-- Hotfix: KW + numer mieszkania na tabeli Offer (mobile edycja / Prisma).
-- Uruchomienie: `npx prisma migrate deploy` na prod.

ALTER TABLE `Offer`
  ADD COLUMN `landRegistryNumber` VARCHAR(64) NULL,
  ADD COLUMN `apartmentNumber` VARCHAR(32) NULL;
