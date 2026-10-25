-- Promocja na Facebooku: strona firmy, grupy, publikacje z linkami śledzącymi, unikalne wejścia.
-- Tylko dodawanie. Idempotentne.
CREATE TABLE IF NOT EXISTS `MarketingFacebookPage` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `scopeKey` VARCHAR(40) NOT NULL,
  `pageId` VARCHAR(64) NOT NULL,
  `pageName` VARCHAR(191) NOT NULL,
  `pageUrl` VARCHAR(255) NULL,
  `followers` INT NULL,
  `tokenEnc` TEXT NOT NULL,
  `connectedById` INT NOT NULL,
  `connectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastError` VARCHAR(500) NULL,
  `lastErrorAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `MarketingFacebookPage_scopeKey_key` (`scopeKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MarketingFacebookGroup` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `scopeKey` VARCHAR(40) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `url` VARCHAR(500) NOT NULL,
  `city` VARCHAR(96) NULL,
  `members` INT NULL,
  `note` VARCHAR(300) NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdById` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastPostedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `MarketingFacebookGroup_scopeKey_idx` (`scopeKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MarketingPublication` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `scopeKey` VARCHAR(40) NOT NULL,
  `offerId` INT NOT NULL,
  `clientId` INT NULL,
  `agencyUserId` INT NOT NULL,
  `channel` VARCHAR(24) NOT NULL,
  `groupId` INT NULL,
  `code` VARCHAR(24) NOT NULL,
  `externalId` VARCHAR(120) NULL,
  `postUrl` VARCHAR(500) NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
  `error` VARCHAR(500) NULL,
  `activityId` INT NULL,
  `visits` INT NOT NULL DEFAULT 0,
  `inquiries` INT NOT NULL DEFAULT 0,
  `lastVisitAt` DATETIME(3) NULL,
  `stats` JSON NULL,
  `statsAt` DATETIME(3) NULL,
  `publishedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `MarketingPublication_code_key` (`code`),
  INDEX `MarketingPublication_offerId_idx` (`offerId`),
  INDEX `MarketingPublication_scopeKey_createdAt_idx` (`scopeKey`, `createdAt`),
  INDEX `MarketingPublication_groupId_idx` (`groupId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MarketingVisit` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `publicationId` INT NOT NULL,
  `visitorHash` CHAR(64) NOT NULL,
  `day` CHAR(10) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `MarketingVisit_pub_visitor_day` (`publicationId`, `visitorHash`, `day`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
