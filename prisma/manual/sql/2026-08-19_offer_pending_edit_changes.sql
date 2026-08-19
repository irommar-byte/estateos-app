-- Edycja oferty: admin widzi z czego na co zmienił klient (poza samą ceną).
ALTER TABLE `Offer` ADD COLUMN IF NOT EXISTS `pendingEditChanges` JSON NULL;
