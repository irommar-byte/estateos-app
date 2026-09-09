-- Extracted from former runtime ensure* DDL. Safe to re-run (IF NOT EXISTS).

-- src/lib/desk/ensureSchema.ts
CREATE TABLE IF NOT EXISTS `DeskCase` (
        `id` INTEGER NOT NULL AUTO_INCREMENT,
        `agencyUserId` INTEGER NOT NULL,
        `clientId` INTEGER NOT NULL,
        `kind` VARCHAR(8) NOT NULL,
        `pipelineStage` VARCHAR(32) NOT NULL,
        `source` VARCHAR(64) NULL,
        `sourceUrl` VARCHAR(1024) NULL,
        `propertySnapshot` JSON NULL,
        `linkedOfferId` INTEGER NULL,
        `linkedDealId` INTEGER NULL,
        `linkedAcquisitionId` INTEGER NULL,
        `nextAction` VARCHAR(255) NULL,
        `nextActionAt` DATETIME(3) NULL,
        `temperature` VARCHAR(8) NOT NULL DEFAULT 'WARM',
        `health` VARCHAR(16) NOT NULL DEFAULT 'HEALTHY',
        `lastContactedAt` DATETIME(3) NULL,
        `contractEndsAt` DATETIME(3) NULL,
        `lostReason` VARCHAR(255) NULL,
        `title` VARCHAR(255) NULL,
        `metadata` JSON NULL,
        `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (`id`),
        KEY `DeskCase_agencyUserId_kind_pipelineStage_idx` (`agencyUserId`, `kind`, `pipelineStage`),
        KEY `DeskCase_agencyUserId_nextActionAt_idx` (`agencyUserId`, `nextActionAt`),
        KEY `DeskCase_agencyUserId_health_temperature_idx` (`agencyUserId`, `health`, `temperature`),
        KEY `DeskCase_clientId_idx` (`clientId`),
        KEY `DeskCase_linkedOfferId_idx` (`linkedOfferId`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- src/lib/desk/ensureSchema.ts
CREATE TABLE IF NOT EXISTS `DeskTask` (
        `id` INTEGER NOT NULL AUTO_INCREMENT,
        `agencyUserId` INTEGER NOT NULL,
        `caseId` INTEGER NULL,
        `clientId` INTEGER NULL,
        `title` VARCHAR(255) NOT NULL,
        `status` VARCHAR(16) NOT NULL DEFAULT 'OPEN',
        `priority` VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
        `dueAt` DATETIME(3) NULL,
        `trigger` VARCHAR(64) NULL,
        `completedAt` DATETIME(3) NULL,
        `metadata` JSON NULL,
        `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (`id`),
        KEY `DeskTask_agencyUserId_status_dueAt_idx` (`agencyUserId`, `status`, `dueAt`),
        KEY `DeskTask_caseId_status_idx` (`caseId`, `status`),
        KEY `DeskTask_clientId_idx` (`clientId`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- src/lib/importDuplicateGuard.ts
CREATE TABLE IF NOT EXISTS ImportExternalLock (
        source VARCHAR(32) NOT NULL,
        externalId VARCHAR(64) NOT NULL,
        offerId INT NOT NULL DEFAULT 0,
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (source, externalId),
        KEY ImportExternalLock_offerId_idx (offerId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- src/lib/keiAmerListingState.ts
CREATE TABLE IF NOT EXISTS KeiAmerListingState (
        id INT NOT NULL AUTO_INCREMENT,
        portalUrl VARCHAR(512) NOT NULL,
        keiListingId VARCHAR(64) NULL,
        outreachSentAt DATETIME(3) NULL,
        outreachByAdminId INT NULL,
        importedOfferId INT NULL,
        importedAt DATETIME(3) NULL,
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY KeiAmerListingState_portalUrl_key (portalUrl(191))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- src/lib/market/ensureMarketTables.ts
CREATE TABLE IF NOT EXISTS MarketTransaction (
      id INTEGER NOT NULL AUTO_INCREMENT,
      gmlId VARCHAR(64) NOT NULL,
      sourceIip VARCHAR(64) NOT NULL,
      unitId VARCHAR(191) NULL,
      kind VARCHAR(16) NOT NULL DEFAULT 'LOCAL',
      teryt VARCHAR(16) NULL,
      city VARCHAR(96) NULL,
      district VARCHAR(96) NULL,
      street VARCHAR(191) NULL,
      address VARCHAR(255) NULL,
      lat DOUBLE NULL,
      lng DOUBLE NULL,
      deedAt DATETIME(3) NULL,
      marketType VARCHAR(24) NULL,
      transactionKind VARCHAR(48) NULL,
      share VARCHAR(24) NULL,
      shareRatio DOUBLE NULL,
      rooms INTEGER NULL,
      floor INTEGER NULL,
      areaM2 DOUBLE NULL,
      ancillaryM2 DOUBLE NULL,
      functionCode VARCHAR(48) NULL,
      priceGross DOUBLE NULL,
      vatAmount DOUBLE NULL,
      pricePerM2 DOUBLE NULL,
      qualityOk BOOLEAN NOT NULL DEFAULT false,
      qualityFlags VARCHAR(255) NULL,
      ingestedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY MarketTransaction_gmlId_key (gmlId),
      KEY MarketTransaction_kind_quality_deed_idx (kind, qualityOk, deedAt),
      KEY MarketTransaction_city_district_quality_deed_idx (city, district, qualityOk, deedAt),
      KEY MarketTransaction_lat_lng_idx (lat, lng),
      KEY MarketTransaction_pricePerM2_idx (pricePerM2),
      KEY MarketTransaction_sourceIip_idx (sourceIip)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- src/lib/market/ensureMarketTables.ts
CREATE TABLE IF NOT EXISTS MarketAreaStat (
      id INTEGER NOT NULL AUTO_INCREMENT,
      city VARCHAR(96) NOT NULL,
      district VARCHAR(96) NOT NULL DEFAULT '',
      periodDays INTEGER NOT NULL,
      kind VARCHAR(16) NOT NULL DEFAULT 'LOCAL',
      marketType VARCHAR(24) NOT NULL DEFAULT 'all',
      txnCount INTEGER NOT NULL DEFAULT 0,
      avgPpsm DOUBLE NULL,
      medianPpsm DOUBLE NULL,
      p25Ppsm DOUBLE NULL,
      p75Ppsm DOUBLE NULL,
      yoyChangePct DOUBLE NULL,
      computedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY MarketAreaStat_scope_key (city, district, periodDays, kind, marketType),
      KEY MarketAreaStat_city_period_kind_idx (city, periodDays, kind)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- src/lib/market/ensureMarketTables.ts
CREATE TABLE IF NOT EXISTS MarketIngestRun (
      id INTEGER NOT NULL AUTO_INCREMENT,
      status VARCHAR(24) NOT NULL,
      source VARCHAR(64) NOT NULL,
      startedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      finishedAt DATETIME(3) NULL,
      fetched INTEGER NOT NULL DEFAULT 0,
      upserted INTEGER NOT NULL DEFAULT 0,
      skipped INTEGER NOT NULL DEFAULT 0,
      error TEXT NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- src/lib/market/ensureMarketTables.ts
CREATE TABLE IF NOT EXISTS MarketValuationReport (
      id INTEGER NOT NULL AUTO_INCREMENT,
      userId INTEGER NULL,
      email VARCHAR(191) NOT NULL,
      purpose VARCHAR(24) NOT NULL,
      creditUsed BOOLEAN NOT NULL DEFAULT false,
      subjectJson LONGTEXT NOT NULL,
      resultJson LONGTEXT NOT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY MarketValuationReport_email_createdAt_idx (email, createdAt),
      KEY MarketValuationReport_userId_createdAt_idx (userId, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- src/lib/market/ensureMarketTables.ts
CREATE TABLE IF NOT EXISTS MarketValuationDraft (
      id INTEGER NOT NULL AUTO_INCREMENT,
      email VARCHAR(191) NOT NULL,
      userId INTEGER NULL,
      subjectJson LONGTEXT NOT NULL,
      listingPrice DOUBLE NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      consumedAt DATETIME(3) NULL,
      PRIMARY KEY (id),
      KEY MarketValuationDraft_email_idx (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- src/lib/auction.ts
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
        INDEX `AuctionEvent_status_endsAt_idx` (`status`, `endsAt`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- src/lib/auction.ts
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
        INDEX `AuctionBidEntry_userId_idx` (`userId`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- src/lib/carsStorage.ts
CREATE TABLE IF NOT EXISTS CarListing (
    id INT NOT NULL AUTO_INCREMENT,
    userId INT NULL,
    title VARCHAR(255) NOT NULL,
    make VARCHAR(120) NOT NULL,
    model VARCHAR(120) NOT NULL,
    year INT NOT NULL,
    mileageKm INT NOT NULL DEFAULT 0,
    fuelType VARCHAR(80) NOT NULL,
    transmission VARCHAR(80) NOT NULL,
    bodyType VARCHAR(80) NOT NULL,
    pricePln DECIMAL(12,2) NOT NULL,
    city VARCHAR(120) NOT NULL,
    imageUrl TEXT NULL,
    images TEXT NULL,
    description TEXT NULL,
    cityLat DECIMAL(10,7) NULL,
    cityLng DECIMAL(10,7) NULL,
    generation VARCHAR(120) NULL,
    enginePower VARCHAR(80) NULL,
    engineCapacity VARCHAR(40) NULL,
    trimVersion VARCHAR(160) NULL,
    doorCount TINYINT NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY CarListing_createdAt_idx (createdAt),
    KEY CarListing_userId_idx (userId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- src/lib/offerPublication.ts
CREATE TABLE IF NOT EXISTS OfferPublication (
        id BIGINT NOT NULL AUTO_INCREMENT,
        offerId INT NOT NULL,
        userId INT NOT NULL,
        kind VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        startedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        endsAt DATETIME(3) NOT NULL,
        endedAt DATETIME(3) NULL,
        endReason VARCHAR(30) NULL,
        iapTransactionId VARCHAR(128) NULL,
        iapProductId VARCHAR(64) NULL,
        dealId INT NULL,
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY OfferPublication_offer_status_idx (offerId, status),
        KEY OfferPublication_user_status_idx (userId, status),
        KEY OfferPublication_ends_at_idx (endsAt, status),
        KEY OfferPublication_deal_idx (dealId),
        UNIQUE KEY OfferPublication_iap_tx_unique (iapTransactionId),
        CONSTRAINT OfferPublication_offer_fk FOREIGN KEY (offerId) REFERENCES Offer(id) ON DELETE CASCADE,
        CONSTRAINT OfferPublication_user_fk FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
        CONSTRAINT OfferPublication_deal_fk FOREIGN KEY (dealId) REFERENCES Deal(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- src/lib/estateOsMailAlias.ts
CREATE TABLE IF NOT EXISTS EstateOsMailAlias (
        id INT NOT NULL AUTO_INCREMENT,
        userId INT NOT NULL,
        localPart VARCHAR(32) NOT NULL,
        domain VARCHAR(64) NOT NULL DEFAULT 'estateos.pl',
        forwardTo VARCHAR(191) NOT NULL,
        improvmxId INT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY EstateOsMailAlias_local_unique (localPart, domain),
        KEY EstateOsMailAlias_user_idx (userId),
        CONSTRAINT EstateOsMailAlias_user_fk FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- src/lib/offerPrivateNotes.ts
CREATE TABLE IF NOT EXISTS OfferPrivateNote (
      id BIGINT NOT NULL AUTO_INCREMENT,
      offerId INT NOT NULL,
      userId INT NOT NULL,
      userNote TEXT NULL,
      importSource VARCHAR(64) NULL,
      importExternalUrl TEXT NULL,
      importExternalId VARCHAR(64) NULL,
      importSnapshotJson LONGTEXT NULL,
      sourceIsActive TINYINT(1) NULL,
      sourceLastCheckAt DATETIME(3) NULL,
      sourceLastHttpStatus INT NULL,
      sourceLastError VARCHAR(512) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY OfferPrivateNote_offerId_userId_key (offerId, userId),
      KEY OfferPrivateNote_offerId_idx (offerId),
      KEY OfferPrivateNote_userId_idx (userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- src/lib/pageVisitLogTable.ts
CREATE TABLE IF NOT EXISTS PageVisitLog (
        id BIGINT NOT NULL AUTO_INCREMENT,
        visitorHash VARCHAR(64) NOT NULL,
        ip VARCHAR(64) NOT NULL,
        country VARCHAR(8) NOT NULL DEFAULT 'UN',
        path VARCHAR(191) NOT NULL DEFAULT '/',
        userAgent VARCHAR(255) NULL,
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY PageVisitLog_path_createdAt_idx (path, createdAt),
        KEY PageVisitLog_hash_createdAt_idx (visitorHash, createdAt),
        KEY PageVisitLog_createdAt_idx (createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- src/lib/carRadarStorage.ts
CREATE TABLE IF NOT EXISTS CarRadarPreference (
      id INT NOT NULL AUTO_INCREMENT,
      userId INT NOT NULL,
      queryText VARCHAR(512) NOT NULL DEFAULT '',
      vehicleType VARCHAR(64) NOT NULL DEFAULT '',
      make VARCHAR(128) NOT NULL DEFAULT '',
      model VARCHAR(128) NOT NULL DEFAULT '',
      generation VARCHAR(128) NOT NULL DEFAULT '',
      fuelType VARCHAR(64) NOT NULL DEFAULT '',
      bodyType VARCHAR(64) NOT NULL DEFAULT '',
      exteriorColor VARCHAR(64) NOT NULL DEFAULT '',
      transmission VARCHAR(64) NOT NULL DEFAULT '',
      city VARCHAR(128) NOT NULL DEFAULT '',
      minPrice DOUBLE NULL,
      maxPrice DOUBLE NULL,
      minYear INT NULL,
      maxYear INT NULL,
      minMileage INT NULL,
      maxMileage INT NULL,
      lat DOUBLE NULL,
      lng DOUBLE NULL,
      radius DOUBLE NULL,
      pushNotifications TINYINT(1) NOT NULL DEFAULT 1,
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      minMatchThreshold INT NOT NULL DEFAULT 70,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY CarRadarPreference_userId_key (userId),
      KEY CarRadarPreference_push_enabled_idx (pushNotifications, enabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- src/lib/profilePromoCards.ts
CREATE TABLE IF NOT EXISTS MobileProfilePromoCard (
      id VARCHAR(64) NOT NULL,
      userId INT NOT NULL,
      kind VARCHAR(32) NOT NULL DEFAULT 'admin_promo',
      title VARCHAR(191) NOT NULL,
      subtitle VARCHAR(255) NOT NULL DEFAULT '',
      meta TEXT NULL,
      accentColor VARCHAR(32) NULL,
      iconName VARCHAR(64) NULL,
      pillLabel VARCHAR(64) NULL,
      templateId VARCHAR(64) NULL,
      grantsFreeListing TINYINT(1) NOT NULL DEFAULT 0,
      couponUsed TINYINT(1) NOT NULL DEFAULT 0,
      purpose VARCHAR(32) NULL,
      birthdayYear INT NULL,
      expiresAt DATETIME(3) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY MobileProfilePromoCard_user_idx (userId, couponUsed, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- src/lib/walletLedger.ts
CREATE TABLE IF NOT EXISTS WalletLedgerEvent (
      id BIGINT NOT NULL AUTO_INCREMENT,
      userId INT NOT NULL,
      direction VARCHAR(8) NOT NULL,
      assetType VARCHAR(32) NOT NULL,
      amount INT NOT NULL DEFAULT 1,
      balanceAfter INT NULL,
      purpose VARCHAR(64) NOT NULL,
      referenceType VARCHAR(32) NULL,
      referenceId VARCHAR(128) NULL,
      label VARCHAR(255) NOT NULL,
      meta JSON NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY WalletLedgerEvent_user_created_idx (userId, createdAt),
      KEY WalletLedgerEvent_ref_idx (referenceType, referenceId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- src/lib/mobileUgcTables.ts
CREATE TABLE IF NOT EXISTS MobileUserBlock (
      id BIGINT NOT NULL AUTO_INCREMENT,
      blockerUserId INT NOT NULL,
      blockedUserId INT NOT NULL,
      reason VARCHAR(191) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY MobileUserBlock_blocker_blocked_key (blockerUserId, blockedUserId),
      KEY MobileUserBlock_blocker_idx (blockerUserId),
      KEY MobileUserBlock_blocked_idx (blockedUserId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- src/lib/mobileUgcTables.ts
CREATE TABLE IF NOT EXISTS MobileContentReport (
      id BIGINT NOT NULL AUTO_INCREMENT,
      reporterUserId INT NOT NULL,
      targetType VARCHAR(32) NOT NULL,
      targetId VARCHAR(191) NULL,
      reportedUserId INT NULL,
      category VARCHAR(64) NOT NULL DEFAULT 'OTHER',
      reason TEXT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY MobileContentReport_reporter_idx (reporterUserId),
      KEY MobileContentReport_target_idx (targetType, targetId),
      KEY MobileContentReport_status_idx (status, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- src/lib/mobileIapTables.ts
CREATE TABLE IF NOT EXISTS MobileIapPurchase (
      id BIGINT NOT NULL AUTO_INCREMENT,
      userId INT NOT NULL,
      pendingPurchaseId VARCHAR(191) NOT NULL,
      platform VARCHAR(24) NOT NULL DEFAULT 'ios',
      productId VARCHAR(191) NOT NULL,
      transactionId VARCHAR(191) NULL,
      originalTransactionId VARCHAR(191) NULL,
      receipt TEXT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'VERIFIED',
      entitlementGrantedAt DATETIME(3) NULL,
      rawPayload LONGTEXT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY MobileIapPurchase_pending_key (pendingPurchaseId),
      KEY MobileIapPurchase_user_idx (userId),
      KEY MobileIapPurchase_transaction_idx (transactionId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Extra columns previously applied by runtime ensure*
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS generation VARCHAR(120) NULL;
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS enginePower VARCHAR(80) NULL;
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS engineCapacity VARCHAR(40) NULL;
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS trimVersion VARCHAR(160) NULL;
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS doorCount TINYINT NULL;
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS images TEXT NULL;
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS description TEXT NULL;
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS cityLat DECIMAL(10,7) NULL;
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS cityLng DECIMAL(10,7) NULL;
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS localityCountry VARCHAR(80) NULL;
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS vin VARCHAR(17) NULL;
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS registrationNumber VARCHAR(16) NULL;
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS firstRegistrationDate VARCHAR(20) NULL;
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS insuranceValidUntil VARCHAR(20) NULL;
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS restrictVehicleDocs TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS showContactPhone TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS promotedUntil DATETIME(3) NULL;
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS exteriorColor VARCHAR(80) NULL;
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS vehicleType VARCHAR(32) NULL DEFAULT 'car';
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS price DECIMAL(12,2) NULL;
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS priceCurrency VARCHAR(8) NOT NULL DEFAULT 'PLN';
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS exchangeRateUsed DOUBLE NULL;
ALTER TABLE CarListing ADD COLUMN IF NOT EXISTS exchangeRateDate DATETIME(3) NULL;

CREATE TABLE IF NOT EXISTS CarEngagement (
  carId INT NOT NULL,
  viewsCount INT NOT NULL DEFAULT 0,
  favoritesCount INT NOT NULL DEFAULT 0,
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (carId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS OfferViewLog (
  id BIGINT NOT NULL AUTO_INCREMENT,
  offerId INT NOT NULL,
  visitorKey VARCHAR(128) NOT NULL,
  source VARCHAR(16) NOT NULL DEFAULT 'web',
  ip VARCHAR(64) NULL,
  userAgent VARCHAR(255) NULL,
  hits INT NOT NULL DEFAULT 1,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  lastSeenAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY OfferViewLog_offerId_visitorKey_key (offerId, visitorKey),
  KEY OfferViewLog_offerId_lastSeenAt_idx (offerId, lastSeenAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE Offer ADD COLUMN IF NOT EXISTS pendingPublicationKind VARCHAR(20) NULL;
ALTER TABLE Offer ADD COLUMN IF NOT EXISTS pendingBonusCouponId VARCHAR(64) NULL;
ALTER TABLE Offer ADD COLUMN IF NOT EXISTS pendingIapTransactionId VARCHAR(128) NULL;
ALTER TABLE Offer ADD COLUMN IF NOT EXISTS pendingPublicationCreatedAt DATETIME(3) NULL;
ALTER TABLE Offer ADD COLUMN IF NOT EXISTS pendingPublicationEntitlementConsumed TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE User ADD COLUMN IF NOT EXISTS firstFreePublicationUsed TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE User ADD COLUMN IF NOT EXISTS plusExpiresAt DATETIME(3) NULL;
ALTER TABLE User ADD COLUMN IF NOT EXISTS marketReportCredits INTEGER NOT NULL DEFAULT 0;

ALTER TABLE MarketValuationReport ADD COLUMN IF NOT EXISTS clientId INTEGER NULL;
ALTER TABLE MarketValuationReport ADD COLUMN IF NOT EXISTS offerId INTEGER NULL;
CREATE INDEX IF NOT EXISTS MarketValuationReport_clientId_createdAt_idx ON MarketValuationReport (clientId, createdAt);
CREATE INDEX IF NOT EXISTS MarketValuationReport_offerId_createdAt_idx ON MarketValuationReport (offerId, createdAt);

ALTER TABLE MobileIapPurchase ADD COLUMN IF NOT EXISTS entitlementGrantedAt DATETIME(3) NULL;
ALTER TABLE MobileIapPurchase ADD COLUMN IF NOT EXISTS verifyStatus VARCHAR(24) NOT NULL DEFAULT 'VERIFIED';
ALTER TABLE MobileIapPurchase ADD COLUMN IF NOT EXISTS targetOfferId INT NULL;
ALTER TABLE MobileIapPurchase ADD COLUMN IF NOT EXISTS offerId INT NULL;
ALTER TABLE MobileIapPurchase ADD COLUMN IF NOT EXISTS consumedAt DATETIME(3) NULL;
CREATE INDEX IF NOT EXISTS MobileIapPurchase_verify_status_idx ON MobileIapPurchase (verifyStatus);
CREATE INDEX IF NOT EXISTS MobileIapPurchase_consumed_at_idx ON MobileIapPurchase (consumedAt);

ALTER TABLE PageVisitLog ADD COLUMN IF NOT EXISTS city VARCHAR(64) NULL;
ALTER TABLE PageVisitLog ADD COLUMN IF NOT EXISTS regionName VARCHAR(64) NULL;
ALTER TABLE PageVisitLog ADD COLUMN IF NOT EXISTS isp VARCHAR(128) NULL;
ALTER TABLE PageVisitLog ADD COLUMN IF NOT EXISTS geoSource VARCHAR(16) NOT NULL DEFAULT 'unknown';
ALTER TABLE PageVisitLog ADD COLUMN IF NOT EXISTS deviceType VARCHAR(16) NOT NULL DEFAULT 'unknown';
ALTER TABLE PageVisitLog ADD COLUMN IF NOT EXISTS userId INT NULL;
CREATE INDEX IF NOT EXISTS PageVisitLog_userId_createdAt_idx ON PageVisitLog (userId, createdAt);

ALTER TABLE MobileContentReport ADD COLUMN IF NOT EXISTS adminNote TEXT NULL;
ALTER TABLE MobileContentReport ADD COLUMN IF NOT EXISTS reviewerId INT NULL;

CREATE INDEX IF NOT EXISTS ContactMessage_threadId_createdAt_idx ON ContactMessage (threadId, createdAt);
