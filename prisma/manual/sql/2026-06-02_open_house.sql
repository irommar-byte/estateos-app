-- Dzień otwartych drzwi — tabele OpenHouseEvent / OpenHouseSlot / OpenHouseReservation
-- Uruchom na produkcji po weryfikacji nazw lub użyj `npx prisma db push` w deploy/estateos-www-full.

CREATE TABLE IF NOT EXISTS `OpenHouseEvent` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `offerId` INT NOT NULL,
  `hostUserId` INT NOT NULL,
  `title` VARCHAR(255) NULL,
  `description` LONGTEXT NULL,
  `status` ENUM('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'DRAFT',
  `publishedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `OpenHouseEvent_offerId_idx` (`offerId`),
  INDEX `OpenHouseEvent_hostUserId_idx` (`hostUserId`),
  INDEX `OpenHouseEvent_status_publishedAt_idx` (`status`, `publishedAt`),
  CONSTRAINT `OpenHouseEvent_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `Offer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `OpenHouseEvent_hostUserId_fkey` FOREIGN KEY (`hostUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `OpenHouseSlot` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `eventId` INT NOT NULL,
  `startsAt` DATETIME(3) NOT NULL,
  `endsAt` DATETIME(3) NOT NULL,
  `capacity` INT NOT NULL DEFAULT 8,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `OpenHouseSlot_eventId_startsAt_idx` (`eventId`, `startsAt`),
  CONSTRAINT `OpenHouseSlot_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `OpenHouseEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `OpenHouseReservation` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `slotId` INT NOT NULL,
  `userId` INT NOT NULL,
  `guestCount` INT NOT NULL DEFAULT 1,
  `status` ENUM('CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
  `note` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `OpenHouseReservation_slotId_userId_key` (`slotId`, `userId`),
  INDEX `OpenHouseReservation_userId_idx` (`userId`),
  CONSTRAINT `OpenHouseReservation_slotId_fkey` FOREIGN KEY (`slotId`) REFERENCES `OpenHouseSlot`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `OpenHouseReservation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
