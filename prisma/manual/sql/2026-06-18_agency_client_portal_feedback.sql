-- Portal klienta + feedback do dopasowań
ALTER TABLE `AgencyClient`
  ADD COLUMN `portalToken` VARCHAR(64) NULL,
  ADD UNIQUE INDEX `AgencyClient_portalToken_key` (`portalToken`);

ALTER TABLE `AgencyClientMatch`
  ADD COLUMN `clientFeedback` TEXT NULL,
  ADD COLUMN `clientFeedbackAt` DATETIME(3) NULL;

-- Tokeny portalu dla istniejących klientów
UPDATE `AgencyClient` SET `portalToken` = REPLACE(UUID(), '-', '') WHERE `portalToken` IS NULL;
