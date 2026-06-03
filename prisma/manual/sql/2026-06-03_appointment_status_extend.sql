-- Rozszerzenie statusów wizyt (prezentacje: COMPLETED / NO_SHOW / CANCELLED)

ALTER TABLE `Appointment`
  MODIFY `status` ENUM(
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'RESCHEDULED',
    'COMPLETED',
    'NO_SHOW',
    'CANCELLED'
  ) NOT NULL DEFAULT 'PENDING';
