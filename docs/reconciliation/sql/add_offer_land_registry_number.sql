-- Offer: kolumny zgodne z prisma/schema.prisma (model Offer)
-- Naprawia błąd: "The column estateos_prod.Offer.landRegistryNumber does not exist"
-- Uruchom na produkcyjnym MySQL (DATABASE_URL → baza estateos_prod) przed użyciem edycji oferty z polem KW.

-- Jeśli któryś ALTER zwróci "Duplicate column name", kolumna już istnieje — pomiń ten wiersz.

ALTER TABLE `Offer` ADD COLUMN `landRegistryNumber` VARCHAR(64) NULL;
ALTER TABLE `Offer` ADD COLUMN `apartmentNumber` VARCHAR(64) NULL;
