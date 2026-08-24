-- Persistent unread state and Web Push subscriptions for the CRM client portal.
CREATE TABLE IF NOT EXISTS `ClientPortalChatState` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `clientId` INT NOT NULL,
  `clientLastReadAt` DATETIME(3) NULL,
  `agentLastReadAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ClientPortalChatState_clientId_key` (`clientId`),
  CONSTRAINT `ClientPortalChatState_clientId_fkey`
    FOREIGN KEY (`clientId`) REFERENCES `AgencyClient`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ClientPortalPushSubscription` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `clientId` INT NOT NULL,
  `endpoint` TEXT NOT NULL,
  `endpointHash` CHAR(64) NOT NULL,
  `p256dh` VARCHAR(255) NOT NULL,
  `auth` VARCHAR(255) NOT NULL,
  `userAgent` VARCHAR(512) NULL,
  `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ClientPortalPushSubscription_clientId_endpointHash_key` (`clientId`, `endpointHash`),
  INDEX `ClientPortalPushSubscription_clientId_updatedAt_idx` (`clientId`, `updatedAt`),
  CONSTRAINT `ClientPortalPushSubscription_clientId_fkey`
    FOREIGN KEY (`clientId`) REFERENCES `AgencyClient`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
