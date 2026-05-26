-- Reconciliation: Offer.agentCommissionPercent (MySQL / MariaDB)
-- Uruchom na produkcji przed deployem kodu zapisującego prowizję.

ALTER TABLE `Offer`
  ADD COLUMN `agentCommissionPercent` DOUBLE NULL
  AFTER `adminFee`;
