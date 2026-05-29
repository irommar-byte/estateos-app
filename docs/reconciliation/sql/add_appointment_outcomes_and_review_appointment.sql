-- Prezentacje: stany końcowe + opinie per wizyta (WWW + mobile parity).
-- Uruchom na produkcji przed deployem z nowym kodem.

ALTER TABLE `Appointment`
  MODIFY COLUMN `status` ENUM(
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'RESCHEDULED',
    'COMPLETED',
    'NO_SHOW',
    'CANCELLED'
  ) NOT NULL DEFAULT 'PENDING';

ALTER TABLE `Appointment`
  ADD COLUMN `outcomeAt` DATETIME(3) NULL AFTER `status`,
  ADD COLUMN `outcomeById` INT NULL AFTER `outcomeAt`,
  ADD COLUMN `outcomeNote` VARCHAR(500) NULL AFTER `outcomeById`;

ALTER TABLE `Appointment`
  ADD INDEX `Appointment_outcomeById_idx` (`outcomeById`);

ALTER TABLE `Review`
  ADD COLUMN `appointmentId` INT NULL AFTER `dealId`;

ALTER TABLE `Review`
  ADD INDEX `Review_appointmentId_idx` (`appointmentId`);

-- Opinie po konkretnej wizycie (jedna ocena wystawiającego na appointment).
ALTER TABLE `Review`
  ADD UNIQUE INDEX `Review_appointmentId_reviewerId_key` (`appointmentId`, `reviewerId`);

-- Stary unikalny klucz „jedna opinia na deal” blokuje wiele wizyt — usuń jeśli istnieje.
ALTER TABLE `Review` DROP INDEX `Review_dealId_reviewerId_key`;
