-- Dokumenty klienta v3: szablony pól agenta („zapisz na zawsze”).
-- Tylko dodawanie. Idempotentne. Statusy 'na' i 'removed' mieszczą się w istniejącym VARCHAR(16).
CREATE TABLE IF NOT EXISTS `AgentDocumentTemplate` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `agencyUserId` INT NOT NULL,
  `label` VARCHAR(160) NOT NULL,
  `hint` VARCHAR(300) NULL,
  `required` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `AgentDocumentTemplate_agencyUserId_idx` (`agencyUserId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
