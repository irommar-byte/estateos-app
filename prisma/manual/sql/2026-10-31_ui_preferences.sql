-- Ustawienia interfejsu użytkownika (np. kolejność sekcji i skróty paska CRM) — wspólne dla wszystkich urządzeń.
CREATE TABLE IF NOT EXISTS `UserUiPreference` (
  `userId` INT NOT NULL,
  `key` VARCHAR(48) NOT NULL,
  `value` JSON NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`userId`, `key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
