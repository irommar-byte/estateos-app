CREATE TABLE `PhotoSessionRequest` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  `proposedAt` DATETIME(3) NOT NULL,
  `note` TEXT NULL,
  `propertyLabel` VARCHAR(255) NULL,
  `propertyType` VARCHAR(64) NULL,
  `transactionType` VARCHAR(32) NULL,
  `isProFree` BOOLEAN NOT NULL DEFAULT false,
  `acceptedAt` DATETIME(3) NULL,
  `acceptedById` INTEGER NULL,
  `adminNote` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `PhotoSessionRequest_status_createdAt_idx`(`status`, `createdAt`),
  INDEX `PhotoSessionRequest_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PhotoSessionRequest` ADD CONSTRAINT `PhotoSessionRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PhotoSessionRequest` ADD CONSTRAINT `PhotoSessionRequest_acceptedById_fkey` FOREIGN KEY (`acceptedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
