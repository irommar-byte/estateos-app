CREATE TABLE IF NOT EXISTS `SellerNextStep` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `clientId` INT NOT NULL,
  `agencyUserId` INT NOT NULL,
  `currentStep` VARCHAR(255) NOT NULL,
  `nextAction` VARCHAR(255) NOT NULL,
  `clientMessage` TEXT NULL,
  `dueAt` DATETIME(3) NULL,
  `visibleToClient` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SellerNextStep_clientId_key` (`clientId`),
  INDEX `SellerNextStep_agencyUserId_updatedAt_idx` (`agencyUserId`, `updatedAt`),
  CONSTRAINT `SellerNextStep_clientId_fkey`
    FOREIGN KEY (`clientId`) REFERENCES `AgencyClient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ClientDecisionRequest` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `clientId` INT NOT NULL,
  `agencyUserId` INT NOT NULL,
  `kind` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `clientMessage` TEXT NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  `clientResponse` TEXT NULL,
  `dueAt` DATETIME(3) NULL,
  `resolvedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `ClientDecisionRequest_clientId_status_idx` (`clientId`, `status`),
  INDEX `ClientDecisionRequest_agencyUserId_status_updatedAt_idx` (`agencyUserId`, `status`, `updatedAt`),
  CONSTRAINT `ClientDecisionRequest_clientId_fkey`
    FOREIGN KEY (`clientId`) REFERENCES `AgencyClient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SellerMarketingNotification` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `activityId` INT NOT NULL,
  `clientId` INT NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `attempts` INT NOT NULL DEFAULT 0,
  `lastError` TEXT NULL,
  `sentAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SellerMarketingNotification_activityId_key` (`activityId`),
  INDEX `SellerMarketingNotification_status_updatedAt_idx` (`status`, `updatedAt`),
  INDEX `SellerMarketingNotification_clientId_createdAt_idx` (`clientId`, `createdAt`),
  CONSTRAINT `SellerMarketingNotification_activityId_fkey`
    FOREIGN KEY (`activityId`) REFERENCES `AgencyClientActivity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

UPDATE `AgencyClientActivity`
SET `metadata` = JSON_SET(
  COALESCE(`metadata`, JSON_OBJECT()),
  '$.visibleToClient',
  FALSE
)
WHERE `kind` IN (
  'MARKET_REPORT_SENT',
  'LISTING_FEATURED',
  'EXTERNAL_PORTAL',
  'ESTATEOS_ACTIVATED',
  'ESTATEOS_PROMOTED',
  'EXTERNAL_PORTAL_LISTED',
  'EXTERNAL_PORTAL_UPDATED',
  'MARKETING_NOTE'
)
  AND JSON_EXTRACT(COALESCE(`metadata`, JSON_OBJECT()), '$.visibleToClient') IS NULL;
