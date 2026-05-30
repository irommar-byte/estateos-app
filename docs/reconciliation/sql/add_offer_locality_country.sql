-- Kraj lokalizacji oferty (np. Polska / PL, Niemcy / DE).
ALTER TABLE `Offer`
  ADD COLUMN IF NOT EXISTS `localityCountry` VARCHAR(64) NULL DEFAULT 'Polska',
  ADD COLUMN IF NOT EXISTS `localityCountryCode` VARCHAR(8) NULL DEFAULT 'PL';

UPDATE `Offer`
SET
  `localityCountry` = COALESCE(NULLIF(TRIM(`localityCountry`), ''), 'Polska'),
  `localityCountryCode` = COALESCE(NULLIF(TRIM(`localityCountryCode`), ''), 'PL')
WHERE `localityCountry` IS NULL OR `localityCountryCode` IS NULL;
