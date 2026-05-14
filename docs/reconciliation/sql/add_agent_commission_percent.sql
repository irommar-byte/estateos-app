-- Reconciliation P0: Offer.agentCommissionPercent (MySQL / MariaDB)
-- Uruchom na produkcji przed deployem kodu zapisującego prowizję, albo zaraz po deployu przed pierwszym POST/PUT oferty z tym polem.

ALTER TABLE `Offer`
  ADD COLUMN `agentCommissionPercent` DOUBLE NULL
  AFTER `adminFee`;
