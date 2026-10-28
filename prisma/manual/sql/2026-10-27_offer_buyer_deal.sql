-- Kupujący na nieruchomości (ścieżka prezentacja → opinia → negocjacje → transakcja)
-- oraz dokumenty klienta tylko na prośbę agenta. Tylko dodawanie, idempotentne.

CREATE TABLE IF NOT EXISTS `OfferBuyerDeal` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `agencyUserId` INTEGER NOT NULL,
  `offerId` INTEGER NOT NULL,
  `sellerClientId` INTEGER NULL,
  `buyerClientId` INTEGER NULL,
  `externalKey` VARCHAR(64) NULL,
  `externalAgency` VARCHAR(160) NULL,
  `externalName` VARCHAR(160) NULL,
  `externalPhone` VARCHAR(32) NULL,
  `externalEmail` VARCHAR(191) NULL,
  `source` VARCHAR(24) NOT NULL DEFAULT 'manual',
  `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  `scheduledAt` DATETIME(3) NULL,
  `viewedAt` DATETIME(3) NULL,
  `attendanceUrl` VARCHAR(500) NULL,
  `attendanceName` VARCHAR(200) NULL,
  `attendanceAt` DATETIME(3) NULL,
  `feedbackSentiment` VARCHAR(16) NULL,
  `feedbackNote` TEXT NULL,
  `feedbackAt` DATETIME(3) NULL,
  `feedbackRequestedAt` DATETIME(3) NULL,
  `sellerInformedAt` DATETIME(3) NULL,
  `data` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `OfferBuyerDeal_offer_buyer_key` (`offerId`, `buyerClientId`),
  UNIQUE KEY `OfferBuyerDeal_offer_external_key` (`offerId`, `externalKey`),
  KEY `OfferBuyerDeal_agencyUserId_offerId_idx` (`agencyUserId`, `offerId`),
  KEY `OfferBuyerDeal_buyerClientId_idx` (`buyerClientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Domyślne listy dokumentów tworzyły się same przy otwarciu karty. Teraz agent wybiera,
-- o co prosi — zdejmujemy nietknięte pozycje domyślne (bez pliku, bez uwag, bez przeglądu).
UPDATE `ClientDocumentItem`
SET `status` = 'removed', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `status` = 'missing'
  AND `fileUrl` IS NULL
  AND `note` IS NULL
  AND `reviewedAt` IS NULL
  AND `uploadedAt` IS NULL
  AND `itemKey` IN ('kw','ownership','no_debts','no_residents','mortgage_balance','energy','plan','id','financing','mortgage_decision','income','poa');
