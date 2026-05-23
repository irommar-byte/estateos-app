-- Ręcznie: zweryfikuj nazwy tabel/kolumn w swojej bazie przed uruchomieniem.
-- Alternatywa: na serwerze `npx prisma db push` (w katalogu projektu, z poprawnym DATABASE_URL).

-- PlanType (+ INVESTOR) — dopasuj nazwę kolumny jeśli jest inna
ALTER TABLE `User` MODIFY COLUMN `planType` ENUM('NONE', 'PRO', 'AGENCY', 'INVESTOR') NOT NULL DEFAULT 'NONE';

ALTER TABLE `User`
  ADD COLUMN `searchAreaTo` INT NULL,
  ADD COLUMN `searchPlotArea` INT NULL,
  ADD COLUMN `buyerType` VARCHAR(191) NULL;

ALTER TABLE `LeadTransfer`
  ADD COLUMN `commissionRate` DOUBLE NULL,
  ADD COLUMN `commissionTerms` LONGTEXT NULL;

CREATE TABLE IF NOT EXISTS `Alert` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(191) NOT NULL,
  `propertyType` LONGTEXT NOT NULL,
  `district` LONGTEXT NOT NULL,
  `maxPrice` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Alert_email_idx`(`email`),
  INDEX `Alert_createdAt_idx`(`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CalendarNote` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `date` VARCHAR(32) NOT NULL,
  `text` LONGTEXT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `CalendarNote_userId_date_key` (`userId`, `date`),
  INDEX `CalendarNote_userId_idx` (`userId`),
  CONSTRAINT `CalendarNote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
