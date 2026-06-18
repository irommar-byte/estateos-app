ALTER TABLE `AgencyClient`
  ADD COLUMN `linkedUserId` INT NULL;

CREATE INDEX `AgencyClient_linkedUserId_idx` ON `AgencyClient`(`linkedUserId`);

ALTER TABLE `AgencyClient`
  ADD CONSTRAINT `AgencyClient_linkedUserId_fkey`
  FOREIGN KEY (`linkedUserId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
