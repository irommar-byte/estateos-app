-- LegalVerificationRequest — kolejka weryfikacji prawnej (mobile admin + zgłoszenia właściciela)
-- Uruchom na produkcji przed pierwszym użyciem GET/POST /api/mobile/v1/admin/legal-verification

CREATE TABLE IF NOT EXISTS `LegalVerificationRequest` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `offerId` INT NOT NULL,
  `requesterId` INT NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `landRegistryNumber` VARCHAR(128) NOT NULL,
  `apartmentNumber` VARCHAR(64) NULL,
  `note` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `LegalVerificationRequest_status_createdAt_idx` (`status`, `createdAt`),
  KEY `LegalVerificationRequest_offerId_idx` (`offerId`),
  CONSTRAINT `LegalVerificationRequest_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `Offer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `LegalVerificationRequest_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
