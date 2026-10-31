-- Smart Agent OS™ (stanowisko w Partner Enterprise / 5 kredytów na 30 dni) + dziennik zespołu dla kierownika biura.
-- Tylko dodawanie. Idempotentne.
SET @db := DATABASE();

SET @exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='AgencyCompany' AND COLUMN_NAME='smartAgentUserId');
SET @sql := IF(@exists=0, 'ALTER TABLE `AgencyCompany` ADD COLUMN `smartAgentUserId` INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `SmartAgentSeat` (
  `userId` INT NOT NULL,
  `settings` JSON NULL,
  `paidUntil` DATETIME(3) NULL,
  `paidFrom` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AgencyTeamEvent` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `companyId` INT NULL,
  `userId` INT NOT NULL,
  `kind` VARCHAR(48) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `body` TEXT NULL,
  `refType` VARCHAR(32) NULL,
  `refId` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `AgencyTeamEvent_company_createdAt` (`companyId`, `createdAt`),
  KEY `AgencyTeamEvent_user_createdAt` (`userId`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
