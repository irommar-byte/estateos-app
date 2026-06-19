-- Property auction module (Investor Pro)
-- Run on production before deploy if tables missing.

CREATE TABLE IF NOT EXISTS `AuctionEvent` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `offerId` INT NOT NULL,
  `hostUserId` INT NOT NULL,
  `title` VARCHAR(255) NULL,
  `description` TEXT NULL,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'PLN',
  `startPrice` DOUBLE NOT NULL,
  `reservePrice` DOUBLE NULL,
  `minIncrement` DOUBLE NULL,
  `currentPrice` DOUBLE NOT NULL DEFAULT 0,
  `currentBidderUserId` INT NULL,
  `bidCount` INT NOT NULL DEFAULT 0,
  `startsAt` DATETIME(3) NOT NULL,
  `endsAt` DATETIME(3) NOT NULL,
  `extendedEndsAt` DATETIME(3) NULL,
  `status` ENUM('DRAFT','SCHEDULED','LIVE','ENDED','CANCELLED','SETTLED') NOT NULL DEFAULT 'DRAFT',
  `winnerUserId` INT NULL,
  `publishedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `AuctionEvent_offerId_idx` (`offerId`),
  INDEX `AuctionEvent_hostUserId_idx` (`hostUserId`),
  INDEX `AuctionEvent_status_startsAt_idx` (`status`, `startsAt`),
  INDEX `AuctionEvent_status_endsAt_idx` (`status`, `endsAt`),
  CONSTRAINT `AuctionEvent_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `Offer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `AuctionEvent_hostUserId_fkey` FOREIGN KEY (`hostUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AuctionBidEntry` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `eventId` INT NOT NULL,
  `userId` INT NOT NULL,
  `amount` DOUBLE NOT NULL,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'PLN',
  `status` ENUM('VALID','OUTBID','WINNING') NOT NULL DEFAULT 'VALID',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `AuctionBidEntry_eventId_createdAt_idx` (`eventId`, `createdAt`),
  INDEX `AuctionBidEntry_userId_idx` (`userId`),
  CONSTRAINT `AuctionBidEntry_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `AuctionEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `AuctionBidEntry_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
