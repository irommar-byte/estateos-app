-- Jednorazowo: jeśli PageVisitLog.createdAt był zapisywany przez NOW() w strefie Europe/Warsaw,
-- przelicz na UTC (zgodne z UTC_TIMESTAMP w /api/track).
UPDATE PageVisitLog
SET createdAt = CONVERT_TZ(createdAt, 'Europe/Warsaw', 'UTC')
WHERE createdAt IS NOT NULL;
