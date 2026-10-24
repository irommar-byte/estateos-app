-- Panel klienta v2: druga osoba, ulubione z alertami, obszar na mapie, uprawnienia klienta,
-- oferty kupujących u sprzedającego, opinie z oglądań, dane do „ile na rękę”.
-- Tylko dodawanie. Idempotentne (MySQL: sprawdzenie w information_schema).

SET @db := DATABASE();

-- helper: dodaj kolumnę, jeśli nie istnieje
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='AgencyClient' AND COLUMN_NAME='portalPermissions');
SET @sql := IF(@exists=0, 'ALTER TABLE `AgencyClient` ADD COLUMN `portalPermissions` JSON NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='AgencyClient' AND COLUMN_NAME='sellerFinance');
SET @sql := IF(@exists=0, 'ALTER TABLE `AgencyClient` ADD COLUMN `sellerFinance` JSON NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='AgencyClientBuyerPreference' AND COLUMN_NAME='searchPolygon');
SET @sql := IF(@exists=0, 'ALTER TABLE `AgencyClientBuyerPreference` ADD COLUMN `searchPolygon` JSON NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='AgencyClientMatch' AND COLUMN_NAME='clientFavorite');
SET @sql := IF(@exists=0, 'ALTER TABLE `AgencyClientMatch` ADD COLUMN `clientFavorite` TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='AgencyClientMatch' AND COLUMN_NAME='favoriteSnapshot');
SET @sql := IF(@exists=0, 'ALTER TABLE `AgencyClientMatch` ADD COLUMN `favoriteSnapshot` JSON NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='AgencyClientMatch' AND COLUMN_NAME='favoriteAt');
SET @sql := IF(@exists=0, 'ALTER TABLE `AgencyClientMatch` ADD COLUMN `favoriteAt` DATETIME(3) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `AgencyClientCompanion` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `clientId` INTEGER NOT NULL,
  `token` VARCHAR(64) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastSeenAt` DATETIME(3) NULL,
  `revokedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `AgencyClientCompanion_token_key` (`token`),
  KEY `AgencyClientCompanion_clientId_idx` (`clientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AgencyClientCompanionFeedback` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `companionId` INTEGER NOT NULL,
  `matchId` INTEGER NOT NULL,
  `sentiment` VARCHAR(16) NOT NULL,
  `note` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `AgencyClientCompanionFeedback_companion_match_key` (`companionId`, `matchId`),
  KEY `AgencyClientCompanionFeedback_matchId_idx` (`matchId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SellerBuyerOffer` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `clientId` INTEGER NOT NULL,
  `agencyUserId` INTEGER NOT NULL,
  `buyerLabel` VARCHAR(120) NOT NULL,
  `amount` INTEGER NOT NULL,
  `financing` VARCHAR(32) NOT NULL DEFAULT 'cash',
  `deposit` INTEGER NULL,
  `deedWeeks` INTEGER NULL,
  `handoverDays` INTEGER NULL,
  `note` TEXT NULL,
  `recommendation` TEXT NULL,
  `recommendationKind` VARCHAR(16) NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'OPEN',
  `clientResponse` VARCHAR(16) NULL,
  `clientComment` TEXT NULL,
  `counterAmount` INTEGER NULL,
  `respondBy` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `SellerBuyerOffer_clientId_idx` (`clientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SellerShowingFeedback` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `clientId` INTEGER NOT NULL,
  `agencyUserId` INTEGER NOT NULL,
  `tags` JSON NOT NULL,
  `note` VARCHAR(500) NULL,
  `visitAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `SellerShowingFeedback_clientId_idx` (`clientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ClientAppDevice` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `clientId` INTEGER NOT NULL,
  `companionId` INTEGER NULL,
  `apnsToken` VARCHAR(200) NOT NULL,
  `platform` VARCHAR(16) NOT NULL DEFAULT 'ios',
  `prefs` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ClientAppDevice_apnsToken_key` (`apnsToken`),
  KEY `ClientAppDevice_clientId_idx` (`clientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Kod zaproszenia do aplikacji (6 cyfr) — wejście klienta bez konta: QR albo kod.
CREATE TABLE IF NOT EXISTS `ClientInviteCode` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `code` CHAR(6) NOT NULL,
  `clientId` INTEGER NOT NULL,
  `companionId` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `redeemedAt` DATETIME(3) NULL,
  `revokedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ClientInviteCode_code_key` (`code`),
  KEY `ClientInviteCode_clientId_idx` (`clientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Dokumenty klienta: lista „co jeszcze brakuje” + pliki wrzucane z panelu / aplikacji.
CREATE TABLE IF NOT EXISTS `ClientDocumentItem` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `clientId` INTEGER NOT NULL,
  `itemKey` VARCHAR(64) NOT NULL,
  `label` VARCHAR(160) NOT NULL,
  `hint` VARCHAR(300) NULL,
  `required` TINYINT(1) NOT NULL DEFAULT 1,
  `status` VARCHAR(16) NOT NULL DEFAULT 'missing',
  `fileUrl` VARCHAR(500) NULL,
  `fileName` VARCHAR(200) NULL,
  `mimeType` VARCHAR(120) NULL,
  `note` VARCHAR(500) NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `uploadedAt` DATETIME(3) NULL,
  `reviewedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ClientDocumentItem_client_key` (`clientId`, `itemKey`),
  KEY `ClientDocumentItem_clientId_idx` (`clientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
