ALTER TABLE `PhotoSessionRequest`
  ADD COLUMN `waitingOn` VARCHAR(16) NULL AFTER `status`;

UPDATE `PhotoSessionRequest`
SET `waitingOn` = 'ADMIN'
WHERE `status` = 'PENDING' AND `waitingOn` IS NULL;

CREATE TABLE `PhotoSessionEvent` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `requestId` INTEGER NOT NULL,
  `actorUserId` INTEGER NOT NULL,
  `action` VARCHAR(24) NOT NULL,
  `proposedAt` DATETIME(3) NULL,
  `note` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `PhotoSessionEvent_requestId_createdAt_idx`(`requestId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PhotoSessionEvent`
  ADD CONSTRAINT `PhotoSessionEvent_requestId_fkey`
  FOREIGN KEY (`requestId`) REFERENCES `PhotoSessionRequest`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `PhotoSessionEvent` (`requestId`, `actorUserId`, `action`, `proposedAt`, `createdAt`)
SELECT `id`, `userId`, 'PROPOSED', `proposedAt`, `createdAt`
FROM `PhotoSessionRequest`
WHERE `status` = 'PENDING';
