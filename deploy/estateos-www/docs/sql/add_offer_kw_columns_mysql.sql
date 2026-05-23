-- Manual hotfix (MySQL): kolumny KW + nr mieszkania na `Offer`.
-- Użyj, jeśli musisz dodać kolumny zanim zadziała `npx prisma migrate deploy`.
-- Jeśli kolumna już istnieje, ALTER zwróci błąd — wtedy pomiń odpowiedni wiersz.

ALTER TABLE `Offer`
  ADD COLUMN `landRegistryNumber` VARCHAR(64) NULL,
  ADD COLUMN `apartmentNumber` VARCHAR(32) NULL;
