-- Open house: tryb wizyt (elastyczny okien vs sloty co 30/60 min)

ALTER TABLE `OpenHouseEvent`
  ADD COLUMN `visitMode` ENUM('FLEX', 'SLOT_30', 'SLOT_60') NOT NULL DEFAULT 'FLEX' AFTER `description`;
