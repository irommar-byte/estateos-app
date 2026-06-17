ALTER TABLE `AgencyCompanyMember`
  ADD COLUMN `agentTitle` ENUM('DORADCA', 'AGENT', 'BROKER', 'EXPERT', 'LEADER') NOT NULL DEFAULT 'AGENT' AFTER `status`,
  ADD COLUMN `profilePhotoUrl` VARCHAR(512) NULL AFTER `agentTitle`;
