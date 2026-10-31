-- Kredyty biurowe, zatwierdzanie ogłoszeń przez kierownika, Smart Agent z puli biura,
-- linki wyszukiwarki z losowym kodem i ustawienia moderacji w Centrali.
-- Tylko dodawanie. Idempotentne.
SET @db := DATABASE();

-- Widoczność granatowej monety biura dla agentów (decyduje kierownik).
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='AgencyCompany' AND COLUMN_NAME='officeCoinVisibleToAgents');
SET @sql := IF(@exists=0, 'ALTER TABLE `AgencyCompany` ADD COLUMN `officeCoinVisibleToAgents` TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Miesięczny limit kredytów biura, które agent wykorzystuje bez czekania na zgodę (0 = zawsze prośba).
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='AgencyCompanyMember' AND COLUMN_NAME='officeCreditMonthlyLimit');
SET @sql := IF(@exists=0, 'ALTER TABLE `AgencyCompanyMember` ADD COLUMN `officeCreditMonthlyLimit` INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Przypomnienie kierownikowi o prośbie czekającej dłużej niż 12 h.
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='Offer' AND COLUMN_NAME='officeReviewRemindedAt');
SET @sql := IF(@exists=0, 'ALTER TABLE `Offer` ADD COLUMN `officeReviewRemindedAt` DATETIME(3) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Smart Agent: czym opłacony (office = pula biura, personal = kredyty agenta) i kto zapłacił; prośba agenta do kierownika.
SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='SmartAgentSeat' AND COLUMN_NAME='paidWith');
SET @sql := IF(@exists=0, 'ALTER TABLE `SmartAgentSeat` ADD COLUMN `paidWith` VARCHAR(16) NULL, ADD COLUMN `paidByUserId` INT NULL, ADD COLUMN `companyId` INT NULL, ADD COLUMN `requestedAt` DATETIME(3) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Historia kredytów biura: zakupy, pakiet Partner, ogłoszenia, Smart Agent, przydziały.
CREATE TABLE IF NOT EXISTS `AgencyOfficeCreditLedger` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `delta` INT NOT NULL,
  `kind` VARCHAR(24) NOT NULL,
  `userId` INT NULL,
  `forUserId` INT NULL,
  `refType` VARCHAR(24) NULL,
  `refId` VARCHAR(191) NULL,
  `note` VARCHAR(255) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `AgencyOfficeCreditLedger_ref` (`kind`, `refType`, `refId`),
  KEY `AgencyOfficeCreditLedger_company_createdAt` (`companyId`, `createdAt`),
  KEY `AgencyOfficeCreditLedger_forUser_createdAt` (`forUserId`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Link wyszukiwarki /szukam/s/{kod}: enterprise / office (należy do biura) albo personal (do agenta).
CREATE TABLE IF NOT EXISTS `SmartSearchLink` (
  `code` VARCHAR(24) NOT NULL,
  `scope` VARCHAR(16) NOT NULL,
  `companyId` INT NULL,
  `userId` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `revokedAt` DATETIME(3) NULL,
  PRIMARY KEY (`code`),
  KEY `SmartSearchLink_user` (`userId`, `scope`),
  KEY `SmartSearchLink_company` (`companyId`, `scope`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ustawienia platformy (Centrala), np. publikacja bez moderacji.
CREATE TABLE IF NOT EXISTS `PlatformSetting` (
  `key` VARCHAR(64) NOT NULL,
  `value` JSON NULL,
  `updatedById` INT NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
