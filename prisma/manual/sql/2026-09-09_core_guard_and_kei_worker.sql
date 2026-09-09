ALTER TABLE `Offer`
  ADD COLUMN IF NOT EXISTS `landRegistryNumber` VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS `apartmentNumber` VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS `legalCheckStatus` VARCHAR(16) NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS `legalCheckSubmittedAt` DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS `legalCheckReviewedAt` DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS `legalCheckReviewedBy` INT NULL,
  ADD COLUMN IF NOT EXISTS `legalCheckRejectionReason` VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS `legalCheckRejectionText` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `legalCheckOwnerNote` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `isLegalSafeVerified` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `pendingEditChanges` JSON NULL,
  ADD COLUMN IF NOT EXISTS `priceCurrency` VARCHAR(8) NOT NULL DEFAULT 'PLN',
  ADD COLUMN IF NOT EXISTS `pricePln` DOUBLE NULL,
  ADD COLUMN IF NOT EXISTS `exchangeRateUsed` DOUBLE NULL,
  ADD COLUMN IF NOT EXISTS `exchangeRateDate` DATE NULL,
  ADD COLUMN IF NOT EXISTS `hasAirConditioning` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `isDuplex` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `floorPlanExtraUrls` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `localityCountry` VARCHAR(64) NULL DEFAULT 'Polska',
  ADD COLUMN IF NOT EXISTS `localityCountryCode` VARCHAR(8) NULL DEFAULT 'PL',
  ADD COLUMN IF NOT EXISTS `intelligenceAmenityPatches` JSON NULL,
  ADD COLUMN IF NOT EXISTS `listPricePln` DOUBLE NULL;

ALTER TABLE `AgencyClient`
  ADD COLUMN IF NOT EXISTS `intelligenceLockedFields` JSON NULL;

UPDATE `Offer`
SET
  `legalCheckStatus` = COALESCE(NULLIF(TRIM(`legalCheckStatus`), ''), 'NONE'),
  `isLegalSafeVerified` = COALESCE(`isLegalSafeVerified`, 0),
  `priceCurrency` = COALESCE(NULLIF(TRIM(`priceCurrency`), ''), 'PLN'),
  `pricePln` = COALESCE(`pricePln`, `price`),
  `listPricePln` = COALESCE(`listPricePln`, `pricePln`, `price`),
  `localityCountry` = COALESCE(NULLIF(TRIM(`localityCountry`), ''), 'Polska'),
  `localityCountryCode` = COALESCE(NULLIF(TRIM(`localityCountryCode`), ''), 'PL');

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
  KEY `OfferPriceHistory_offerId_recordedAt_idx` (`offerId`, `recordedAt`),
  CONSTRAINT `OfferPriceHistory_offerId_fkey`
    FOREIGN KEY (`offerId`) REFERENCES `Offer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `OfferPriceHistory`
  (`offerId`, `price`, `pricePln`, `priceCurrency`, `changeType`, `source`)
SELECT
  offer.id,
  offer.price,
  COALESCE(offer.pricePln, offer.price),
  COALESCE(offer.priceCurrency, 'PLN'),
  'INITIAL',
  'migration'
FROM `Offer` offer
WHERE NOT EXISTS (
  SELECT 1 FROM `OfferPriceHistory` history WHERE history.offerId = offer.id
);

CREATE TABLE IF NOT EXISTS `KeiAmerImportJob` (
  `id` VARCHAR(36) NOT NULL,
  `adminUserId` INT NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `message` TEXT NULL,
  `propertyKind` VARCHAR(32) NULL,
  `transactionKind` VARCHAR(32) NULL,
  `payloadJson` LONGTEXT NOT NULL,
  `itemsJson` LONGTEXT NOT NULL,
  `resultJson` LONGTEXT NULL,
  `cancelRequested` TINYINT(1) NOT NULL DEFAULT 0,
  `leaseOwner` VARCHAR(191) NULL,
  `leaseUntil` DATETIME(3) NULL,
  `heartbeatAt` DATETIME(3) NULL,
  `attemptCount` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `finishedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `KeiAmerImportJob_status_idx` (`status`),
  KEY `KeiAmerImportJob_admin_idx` (`adminUserId`),
  KEY `KeiAmerImportJob_updated_idx` (`updatedAt`),
  KEY `KeiAmerImportJob_status_lease_idx` (`status`, `leaseUntil`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `KeiAmerImportJob`
  ADD COLUMN IF NOT EXISTS `leaseOwner` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `leaseUntil` DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS `heartbeatAt` DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS `attemptCount` INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS `KeiAmerImportJob_status_lease_idx`
  ON `KeiAmerImportJob` (`status`, `leaseUntil`);

CREATE TABLE IF NOT EXISTS `KeiAutoImportSchedule` (
  `id` TINYINT NOT NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `intervalMinutes` INT NOT NULL DEFAULT 60,
  `count` INT NOT NULL DEFAULT 3,
  `targetUserId` INT NOT NULL DEFAULT 55,
  `agentCommissionPercent` DOUBLE NOT NULL DEFAULT 2,
  `propertyKind` VARCHAR(32) NOT NULL DEFAULT 'apartment',
  `transactionKind` VARCHAR(32) NOT NULL DEFAULT 'sale',
  `adminUserId` INT NOT NULL DEFAULT 0,
  `lastRunAt` DATETIME(3) NULL,
  `lastJobId` VARCHAR(36) NULL,
  `lastError` TEXT NULL,
  `sessionStartedAt` DATETIME(3) NULL,
  `sessionImportedCount` INT NOT NULL DEFAULT 0,
  `sessionSkippedCount` INT NOT NULL DEFAULT 0,
  `sessionCycles` INT NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `KeiAutoImportSchedule`
  ADD COLUMN IF NOT EXISTS `sessionStartedAt` DATETIME(3) NULL,
  ADD COLUMN IF NOT EXISTS `sessionImportedCount` INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `sessionSkippedCount` INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `sessionCycles` INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS `CoreMetricSample` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `collectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `host` VARCHAR(191) NOT NULL,
  `level` VARCHAR(16) NOT NULL,
  `cpuPercent` DOUBLE NOT NULL,
  `load1` DOUBLE NOT NULL,
  `memoryUsedBytes` BIGINT NOT NULL,
  `memoryTotalBytes` BIGINT NOT NULL,
  `swapUsedBytes` BIGINT NOT NULL,
  `diskUsedBytes` BIGINT NOT NULL,
  `diskTotalBytes` BIGINT NOT NULL,
  `requestsPerMin` INT NOT NULL DEFAULT 0,
  `activeConnections` INT NOT NULL DEFAULT 0,
  `latencyP95Ms` DOUBLE NULL,
  `upstreamLatencyP95Ms` DOUBLE NULL,
  `status499` INT NOT NULL DEFAULT 0,
  `status5xx` INT NOT NULL DEFAULT 0,
  `dbLatencyMs` DOUBLE NULL,
  `dbConnections` INT NULL,
  `dbMaxConnections` INT NULL,
  `dbAbortedClients` BIGINT NULL,
  `webRestarts` INT NOT NULL DEFAULT 0,
  `webRssBytes` BIGINT NOT NULL DEFAULT 0,
  `payloadJson` LONGTEXT NULL,
  PRIMARY KEY (`id`),
  KEY `CoreMetricSample_collected_idx` (`collectedAt`),
  KEY `CoreMetricSample_host_collected_idx` (`host`, `collectedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CoreIncident` (
  `id` VARCHAR(36) NOT NULL,
  `fingerprint` VARCHAR(191) NOT NULL,
  `type` VARCHAR(64) NOT NULL,
  `severity` VARCHAR(16) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'open',
  `title` VARCHAR(255) NOT NULL,
  `detail` TEXT NOT NULL,
  `evidenceJson` LONGTEXT NULL,
  `recommendedAction` VARCHAR(64) NULL,
  `autoFixable` TINYINT(1) NOT NULL DEFAULT 0,
  `occurrences` INT NOT NULL DEFAULT 1,
  `firstSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastAlertAt` DATETIME(3) NULL,
  `recoveryAlertAt` DATETIME(3) NULL,
  `cooldownUntil` DATETIME(3) NULL,
  `acknowledgedAt` DATETIME(3) NULL,
  `resolvedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `CoreIncident_fingerprint_key` (`fingerprint`),
  KEY `CoreIncident_status_severity_seen_idx` (`status`, `severity`, `lastSeenAt`),
  KEY `CoreIncident_last_seen_idx` (`lastSeenAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `CoreIncident`
  ADD COLUMN IF NOT EXISTS `recoveryAlertAt` DATETIME(3) NULL;

CREATE TABLE IF NOT EXISTS `CoreRemediationAudit` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `incidentId` VARCHAR(36) NULL,
  `actionId` VARCHAR(64) NOT NULL,
  `mode` VARCHAR(16) NOT NULL,
  `actorUserId` INT NULL,
  `status` VARCHAR(16) NOT NULL,
  `detail` TEXT NULL,
  `beforeJson` LONGTEXT NULL,
  `afterJson` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finishedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `CoreRemediationAudit_created_idx` (`createdAt`),
  KEY `CoreRemediationAudit_incident_created_idx` (`incidentId`, `createdAt`),
  KEY `CoreRemediationAudit_actor_created_idx` (`actorUserId`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
