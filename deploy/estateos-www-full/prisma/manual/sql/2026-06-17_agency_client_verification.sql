ALTER TABLE `AgencyClient`
  ADD COLUMN `pesel` VARCHAR(16) NULL,
  ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL,
  ADD COLUMN `phoneVerifiedAt` DATETIME(3) NULL,
  ADD COLUMN `emailVerifyCode` VARCHAR(16) NULL,
  ADD COLUMN `emailVerifyExpiresAt` DATETIME(3) NULL,
  ADD COLUMN `smsVerifyCode` VARCHAR(16) NULL,
  ADD COLUMN `smsVerifyExpiresAt` DATETIME(3) NULL;
