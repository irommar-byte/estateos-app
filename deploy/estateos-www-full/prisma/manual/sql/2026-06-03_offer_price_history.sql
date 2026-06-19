-- Offer list price + price history for discounted filter and Pro chart
ALTER TABLE `Offer` ADD COLUMN IF NOT EXISTS `listPricePln` DOUBLE NULL;
UPDATE `Offer` SET `listPricePln` = COALESCE(`pricePln`, `price`) WHERE `listPricePln` IS NULL;

CREATE TABLE IF NOT EXISTS `OfferPriceHistory` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `offerId` INT NOT NULL,
  `price` DOUBLE NOT NULL,
  `pricePln` DOUBLE NOT NULL,
  `priceCurrency` VARCHAR(8) NOT NULL DEFAULT 'PLN',
  `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `changeType` VARCHAR(16) NOT NULL DEFAULT 'INITIAL',
  `source` VARCHAR(32) NULL,
  PRIMARY KEY (`id`),
  INDEX `OfferPriceHistory_offerId_recordedAt_idx` (`offerId`, `recordedAt`),
  CONSTRAINT `OfferPriceHistory_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `Offer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
