-- CRM Klienci dla agencji — uruchom na produkcji przed deployem kodu.
-- mysql estateos < prisma/manual/sql/2026-06-16_agency_clients_crm.sql

CREATE TABLE IF NOT EXISTS `AgencyClient` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `agencyUserId` INT NOT NULL,
  `type` ENUM('BUYER', 'SELLER') NOT NULL,
  `status` ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `firstName` VARCHAR(96) NOT NULL,
  `lastName` VARCHAR(96) NOT NULL,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(32) NULL,
  `notes` TEXT NULL,
  `sellerTransactionType` ENUM('SELL', 'RENT') NULL,
  `sellerPropertyType` ENUM('FLAT', 'HOUSE', 'PLOT', 'COMMERCIAL', 'PREMISES') NULL,
  `sellerCity` VARCHAR(128) NULL,
  `sellerDistrict` VARCHAR(128) NULL,
  `sellerPrice` DOUBLE NULL,
  `sellerArea` DOUBLE NULL,
  `sellerRooms` INT NULL,
  `sellerDescription` TEXT NULL,
  `linkedOfferId` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `AgencyClient_agencyUserId_type_status_idx` (`agencyUserId`, `type`, `status`),
  INDEX `AgencyClient_agencyUserId_updatedAt_idx` (`agencyUserId`, `updatedAt`),
  CONSTRAINT `AgencyClient_agencyUserId_fkey` FOREIGN KEY (`agencyUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `AgencyClient_linkedOfferId_fkey` FOREIGN KEY (`linkedOfferId`) REFERENCES `Offer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AgencyClientBuyerPreference` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `clientId` INT NOT NULL,
  `transactionType` ENUM('SELL', 'RENT') NULL,
  `propertyType` ENUM('FLAT', 'HOUSE', 'PLOT', 'COMMERCIAL', 'PREMISES') NULL,
  `city` VARCHAR(128) NULL,
  `districts` JSON NULL,
  `maxPrice` DOUBLE NULL,
  `minArea` DOUBLE NULL,
  `minYear` INT NULL,
  `requireBalcony` BOOLEAN NOT NULL DEFAULT false,
  `requireGarden` BOOLEAN NOT NULL DEFAULT false,
  `requireElevator` BOOLEAN NOT NULL DEFAULT false,
  `requireParking` BOOLEAN NOT NULL DEFAULT false,
  `requireFurnished` BOOLEAN NOT NULL DEFAULT false,
  `minMatchThreshold` INT NOT NULL DEFAULT 70,
  `lat` DOUBLE NULL,
  `lng` DOUBLE NULL,
  `radius` DOUBLE NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `AgencyClientBuyerPreference_clientId_key` (`clientId`),
  CONSTRAINT `AgencyClientBuyerPreference_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `AgencyClient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AgencyClientMatch` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `clientId` INT NOT NULL,
  `offerId` INT NOT NULL,
  `score` INT NOT NULL,
  `notifiedAt` DATETIME(3) NULL,
  `sharedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `AgencyClientMatch_clientId_offerId_key` (`clientId`, `offerId`),
  INDEX `AgencyClientMatch_clientId_score_idx` (`clientId`, `score`),
  CONSTRAINT `AgencyClientMatch_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `AgencyClient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `AgencyClientMatch_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `Offer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AgencyClientActivity` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `clientId` INT NOT NULL,
  `agencyUserId` INT NOT NULL,
  `kind` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NULL,
  `body` TEXT NULL,
  `offerId` INT NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `AgencyClientActivity_clientId_createdAt_idx` (`clientId`, `createdAt`),
  INDEX `AgencyClientActivity_agencyUserId_createdAt_idx` (`agencyUserId`, `createdAt`),
  CONSTRAINT `AgencyClientActivity_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `AgencyClient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
