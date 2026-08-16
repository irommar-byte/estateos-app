-- Prowadzony proces pozyskania nieruchomości, warunki współpracy i ślad podpisu.
CREATE TABLE `AgencyClientAcquisition` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `clientId` INTEGER NOT NULL,
  `agencyUserId` INTEGER NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'PREPARATION',
  `currentStep` INTEGER NOT NULL DEFAULT 1,
  `formData` JSON NOT NULL,
  `agreementSnapshot` LONGTEXT NULL,
  `approvedTemplateConfirmed` BOOLEAN NOT NULL DEFAULT false,
  `clientAcknowledgedAt` DATETIME(3) NULL,
  `clientAcknowledgementName` VARCHAR(191) NULL,
  `signatureSvg` LONGTEXT NULL,
  `signerName` VARCHAR(191) NULL,
  `signerEmail` VARCHAR(191) NULL,
  `signedAt` DATETIME(3) NULL,
  `documentHash` VARCHAR(64) NULL,
  `signerIpHash` VARCHAR(64) NULL,
  `signerUserAgent` VARCHAR(512) NULL,
  `copyEmailSentAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `AgencyClientAcquisition_clientId_key` (`clientId`),
  INDEX `AgencyClientAcquisition_agencyUserId_status_updatedAt_idx` (`agencyUserId`, `status`, `updatedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `AgencyClientAcquisition_clientId_fkey`
    FOREIGN KEY (`clientId`) REFERENCES `AgencyClient` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
