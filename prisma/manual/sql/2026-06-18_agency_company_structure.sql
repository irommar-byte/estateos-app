CREATE TABLE `AgencyCompany` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(64) NULL,
  `address` VARCHAR(255) NULL,
  `website` VARCHAR(255) NULL,
  `logoUrl` VARCHAR(512) NULL,
  `officePhone` VARCHAR(64) NULL,
  `officeEmail` VARCHAR(191) NULL,
  `nip` VARCHAR(32) NULL,
  `extraListings` INT NOT NULL DEFAULT 0,
  `plusExpiresAt` DATETIME(3) NULL,
  `ownerUserId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `AgencyCompany_slug_key`(`slug`),
  UNIQUE INDEX `AgencyCompany_ownerUserId_key`(`ownerUserId`),
  CONSTRAINT `AgencyCompany_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AgencyCompanyMember` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `userId` INT NOT NULL,
  `role` ENUM('ADMIN', 'AGENT') NOT NULL DEFAULT 'AGENT',
  `status` ENUM('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING',
  `approvedAt` DATETIME(3) NULL,
  `approvedById` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `AgencyCompanyMember_userId_key`(`userId`),
  INDEX `AgencyCompanyMember_companyId_status_idx`(`companyId`, `status`),
  CONSTRAINT `AgencyCompanyMember_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `AgencyCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `AgencyCompanyMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `AgencyCompanyMember_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AgencyCompanyCreditTransfer` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `toUserId` INT NOT NULL,
  `amount` INT NOT NULL,
  `note` VARCHAR(255) NULL,
  `createdById` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `AgencyCompanyCreditTransfer_companyId_createdAt_idx`(`companyId`, `createdAt`),
  INDEX `AgencyCompanyCreditTransfer_toUserId_idx`(`toUserId`),
  CONSTRAINT `AgencyCompanyCreditTransfer_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `AgencyCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `AgencyCompanyCreditTransfer_toUserId_fkey` FOREIGN KEY (`toUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `AgencyCompanyCreditTransfer_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
