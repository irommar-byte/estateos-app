-- Katalog WWW/mobile: WHERE status = ACTIVE ORDER BY createdAt DESC
CREATE INDEX IF NOT EXISTS `Offer_status_createdAt_idx` ON `Offer` (`status`, `createdAt`);
-- Mapa / katalog mobile: ACTIVE + współrzędne
CREATE INDEX IF NOT EXISTS `Offer_status_lat_lng_idx` ON `Offer` (`status`, `lat`, `lng`);
