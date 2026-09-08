ALTER TABLE `MarketValuationReport`
  ADD COLUMN `clientId` INTEGER NULL,
  ADD COLUMN `offerId` INTEGER NULL;

CREATE INDEX `MarketValuationReport_clientId_createdAt_idx`
  ON `MarketValuationReport` (`clientId`, `createdAt`);

CREATE INDEX `MarketValuationReport_offerId_createdAt_idx`
  ON `MarketValuationReport` (`offerId`, `createdAt`);
