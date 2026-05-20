-- EstateOS publication model (FREE_FIRST / PLUS_PAID per offerId).
-- Idempotent for MySQL 8+, safe to run in deploy:recon.

SET @db := DATABASE();

CREATE TABLE IF NOT EXISTS `OfferPublication` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `offerId` INT NOT NULL,
  `userId` INT NOT NULL,
  `kind` VARCHAR(20) NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `endsAt` DATETIME(3) NOT NULL,
  `endedAt` DATETIME(3) NULL,
  `endReason` VARCHAR(30) NULL,
  `iapTransactionId` VARCHAR(128) NULL,
  `iapProductId` VARCHAR(64) NULL,
  `dealId` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `OfferPublication_offer_status_idx` (`offerId`, `status`),
  KEY `OfferPublication_user_status_idx` (`userId`, `status`),
  KEY `OfferPublication_ends_at_idx` (`endsAt`, `status`),
  KEY `OfferPublication_deal_idx` (`dealId`),
  UNIQUE KEY `OfferPublication_iap_tx_unique` (`iapTransactionId`),
  CONSTRAINT `OfferPublication_offer_fk` FOREIGN KEY (`offerId`) REFERENCES `Offer` (`id`) ON DELETE CASCADE,
  CONSTRAINT `OfferPublication_user_fk` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE,
  CONSTRAINT `OfferPublication_deal_fk` FOREIGN KEY (`dealId`) REFERENCES `Deal` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User flag: first free publication already used.
SET @c := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'User'
    AND COLUMN_NAME = 'firstFreePublicationUsed'
);
SET @sql := IF(
  @c = 0,
  'ALTER TABLE `User` ADD COLUMN `firstFreePublicationUsed` TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE s FROM @sql;
EXECUTE s;
DEALLOCATE PREPARE s;

-- Optional backfill: users with any historic offers => free-first already consumed.
UPDATE `User` u
SET u.`firstFreePublicationUsed` = 1
WHERE u.`firstFreePublicationUsed` = 0
  AND EXISTS (SELECT 1 FROM `Offer` o WHERE o.`userId` = u.`id`);

-- IAP consume-at-activation support.
SET @c := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'MobileIapPurchase'
    AND COLUMN_NAME = 'verifyStatus'
);
SET @sql := IF(
  @c = 0,
  'ALTER TABLE `MobileIapPurchase` ADD COLUMN `verifyStatus` VARCHAR(24) NOT NULL DEFAULT ''VERIFIED''',
  'SELECT 1'
);
PREPARE s FROM @sql;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'MobileIapPurchase'
    AND COLUMN_NAME = 'targetOfferId'
);
SET @sql := IF(
  @c = 0,
  'ALTER TABLE `MobileIapPurchase` ADD COLUMN `targetOfferId` INT NULL',
  'SELECT 1'
);
PREPARE s FROM @sql;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'MobileIapPurchase'
    AND COLUMN_NAME = 'offerId'
);
SET @sql := IF(
  @c = 0,
  'ALTER TABLE `MobileIapPurchase` ADD COLUMN `offerId` INT NULL',
  'SELECT 1'
);
PREPARE s FROM @sql;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'MobileIapPurchase'
    AND COLUMN_NAME = 'consumedAt'
);
SET @sql := IF(
  @c = 0,
  'ALTER TABLE `MobileIapPurchase` ADD COLUMN `consumedAt` DATETIME(3) NULL',
  'SELECT 1'
);
PREPARE s FROM @sql;
EXECUTE s;
DEALLOCATE PREPARE s;
