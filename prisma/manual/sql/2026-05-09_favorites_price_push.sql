-- Favorites + push preferences for price-change notifications
CREATE TABLE IF NOT EXISTS `FavoriteOffer` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `offerId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `FavoriteOffer_userId_offerId_key` (`userId`,`offerId`),
  KEY `FavoriteOffer_offerId_idx` (`offerId`),
  KEY `FavoriteOffer_userId_idx` (`userId`),
  CONSTRAINT `FavoriteOffer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FavoriteOffer_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `Offer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `DevicePushPreference` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `favoritesEnabled` TINYINT(1) NOT NULL DEFAULT 1,
  `notifyPriceChange` TINYINT(1) NOT NULL DEFAULT 1,
  `notifyDealProposals` TINYINT(1) NOT NULL DEFAULT 1,
  `notifyIncludeAmounts` TINYINT(1) NOT NULL DEFAULT 1,
  `notifyStatusChange` TINYINT(1) NOT NULL DEFAULT 1,
  `notifyNewSimilar` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `DevicePushPreference_userId_key` (`userId`),
  CONSTRAINT `DevicePushPreference_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
