-- Blokada równoległego importu tego samego ogłoszenia (Otodom/OLX/N-O).
CREATE TABLE IF NOT EXISTS ImportExternalLock (
  source VARCHAR(32) NOT NULL,
  externalId VARCHAR(64) NOT NULL,
  offerId INT NOT NULL DEFAULT 0,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (source, externalId),
  KEY ImportExternalLock_offerId_idx (offerId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
