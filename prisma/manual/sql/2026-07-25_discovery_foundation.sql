-- Discovery Foundation v1 — additive / idempotent MySQL 8 migration.
-- Run on production before deploy:
--   npx prisma db execute --file prisma/manual/sql/2026-07-25_discovery_foundation.sql
--
-- It never drops a table or column. Existing DiscoveryEvent / DiscoveryProfile
-- data remains intact and is lazily backfilled into Taste Vector snapshots.

CREATE TABLE IF NOT EXISTS `DiscoveryEvent` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `eventType` VARCHAR(64) NOT NULL,
  `offerId` INT NULL,
  `photoIndex` INT NULL,
  `score` INT NULL,
  `reasonCode` VARCHAR(64) NULL,
  `source` VARCHAR(32) NOT NULL DEFAULT 'mobile_discovery',
  `platform` VARCHAR(16) NOT NULL,
  `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `DiscoveryEvent_user_created_idx` (`userId`, `createdAt`),
  INDEX `DiscoveryEvent_user_event_idx` (`userId`, `eventType`),
  INDEX `DiscoveryEvent_offer_created_idx` (`offerId`, `createdAt`),
  CONSTRAINT `DiscoveryEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `DiscoveryProfile` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `likesCount` INT NOT NULL DEFAULT 0,
  `dislikesCount` INT NOT NULL DEFAULT 0,
  `fastTrackCount` INT NOT NULL DEFAULT 0,
  `opensCount` INT NOT NULL DEFAULT 0,
  `reasonStats` JSON NULL,
  `cityStats` JSON NULL,
  `districtStats` JSON NULL,
  `propertyStats` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `DiscoveryProfile_userId_key` (`userId`),
  CONSTRAINT `DiscoveryProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `DiscoveryEvent`
  ADD COLUMN IF NOT EXISTS `sessionId` VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS `idempotencyKey` VARCHAR(96) NULL,
  ADD COLUMN IF NOT EXISTS `visitOutcome` VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS `correctionTarget` VARCHAR(128) NULL,
  ADD COLUMN IF NOT EXISTS `dwellMs` INT NULL,
  ADD COLUMN IF NOT EXISTS `decisionLatencyMs` INT NULL,
  MODIFY COLUMN `offerId` INT NULL;

ALTER TABLE `DiscoveryProfile`
  ADD COLUMN IF NOT EXISTS `tasteVector` JSON NULL,
  ADD COLUMN IF NOT EXISTS `preferenceVector` JSON NULL,
  ADD COLUMN IF NOT EXISTS `engineVersion` VARCHAR(64) NOT NULL DEFAULT 'discovery-foundation-v1',
  ADD COLUMN IF NOT EXISTS `dnaVersion` VARCHAR(64) NOT NULL DEFAULT 'discovery-dna-v1',
  ADD COLUMN IF NOT EXISTS `confidence` DOUBLE NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `contradictionIndex` DOUBLE NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `explorationHunger` DOUBLE NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS `searchPhase` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS `lastCorrectionAt` DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS `lastVisitAt` DATETIME(3) NULL;

CREATE TABLE IF NOT EXISTS `DiscoverySession` (
  `id` VARCHAR(64) NOT NULL,
  `userId` INT NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  `tempoMode` VARCHAR(32) NOT NULL DEFAULT 'NORMAL',
  `decisionCount` INT NOT NULL DEFAULT 0,
  `explorationBudget` INT NOT NULL DEFAULT 0,
  `shownOfferIds` JSON NULL,
  `undoSnapshot` JSON NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `endedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `DiscoverySession_user_status_activity_idx` (`userId`, `status`, `lastActivityAt`),
  CONSTRAINT `DiscoverySession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `DiscoveryEmbeddingJob` (
  `id` VARCHAR(64) NOT NULL,
  `offerId` INT NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  `modelVersion` VARCHAR(96) NOT NULL DEFAULT 'provider-agnostic-v1',
  `inputHash` VARCHAR(128) NULL,
  `vector` JSON NULL,
  `errorCode` VARCHAR(128) NULL,
  `inputTokens` INT NOT NULL DEFAULT 0,
  `costMicrousd` INT NOT NULL DEFAULT 0,
  `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `processedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `DiscoveryEmbeddingJob_offer_model_key` (`offerId`, `modelVersion`),
  INDEX `DiscoveryEmbeddingJob_status_requested_idx` (`status`, `requestedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `DiscoveryEmbeddingJob`
  ADD COLUMN IF NOT EXISTS `inputTokens` INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `costMicrousd` INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS `DiscoveryAiUsage` (
  `id` VARCHAR(64) NOT NULL,
  `periodKey` VARCHAR(7) NOT NULL,
  `inputTokens` INT NOT NULL DEFAULT 0,
  `costMicrousd` INT NOT NULL DEFAULT 0,
  `jobsComplete` INT NOT NULL DEFAULT 0,
  `jobsFailed` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `DiscoveryAiUsage_periodKey_key` (`periodKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `DiscoveryGalleryPlan` (
  `id` VARCHAR(64) NOT NULL,
  `offerId` INT NOT NULL,
  `algorithmVersion` VARCHAR(96) NOT NULL DEFAULT 'gallery-foundation-v1',
  `sourceHash` VARCHAR(128) NULL,
  `orderedAssets` JSON NULL,
  `assetRoles` JSON NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'READY',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `DiscoveryGalleryPlan_offerId_key` (`offerId`),
  INDEX `DiscoveryGalleryPlan_status_updated_idx` (`status`, `updatedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `DiscoveryTrope` (
  `id` VARCHAR(64) NOT NULL,
  `userId` INT NOT NULL,
  `offerId` INT NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'SAVED',
  `priority` BOOLEAN NOT NULL DEFAULT FALSE,
  `visitOutcome` VARCHAR(32) NULL,
  `note` VARCHAR(512) NULL,
  `savedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `DiscoveryTrope_user_offer_key` (`userId`, `offerId`),
  INDEX `DiscoveryTrope_user_status_updated_idx` (`userId`, `status`, `updatedAt`),
  CONSTRAINT `DiscoveryTrope_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS `DiscoveryEvent_user_session_created_idx`
  ON `DiscoveryEvent` (`userId`, `sessionId`, `createdAt`);
CREATE UNIQUE INDEX IF NOT EXISTS `DiscoveryEvent_idempotencyKey_key`
  ON `DiscoveryEvent` (`idempotencyKey`);
