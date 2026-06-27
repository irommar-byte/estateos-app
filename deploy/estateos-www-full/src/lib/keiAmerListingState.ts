import { prisma } from '@/lib/prisma';
import { findExistingImportedOfferByPortalUrl } from '@/lib/otodomImportCreate';

export type KeiAmerListingDisposition = {
  portalUrl: string;
  keiListingId: string | null;
  outreachSent: boolean;
  outreachSentAt: string | null;
  outreachByAdminId: number | null;
  importedOfferId: number | null;
  importedAt: string | null;
};

let tableReady: Promise<void> | null = null;

export async function ensureKeiAmerListingStateTable(): Promise<void> {
  if (!tableReady) {
    tableReady = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS KeiAmerListingState (
        id INT NOT NULL AUTO_INCREMENT,
        portalUrl VARCHAR(512) NOT NULL,
        keiListingId VARCHAR(64) NULL,
        outreachSentAt DATETIME(3) NULL,
        outreachByAdminId INT NULL,
        importedOfferId INT NULL,
        importedAt DATETIME(3) NULL,
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY KeiAmerListingState_portalUrl_key (portalUrl(191))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).then(() => undefined);
  }
  await tableReady;
}

export function normalizeKeiPortalUrl(url: string): string {
  try {
    const parsed = new URL(String(url || '').trim());
    parsed.hash = '';
    parsed.search = '';
    let path = parsed.pathname.replace(/\/+$/, '');
    if (path && !path.endsWith('/')) path += '/';
    parsed.pathname = path || '/';
    return parsed.toString();
  } catch {
    return String(url || '').trim();
  }
}

type Row = {
  portalUrl: string;
  keiListingId: string | null;
  outreachSentAt: Date | null;
  outreachByAdminId: number | null;
  importedOfferId: number | null;
  importedAt: Date | null;
};

function mapRow(row: Row): KeiAmerListingDisposition {
  return {
    portalUrl: row.portalUrl,
    keiListingId: row.keiListingId,
    outreachSent: Boolean(row.outreachSentAt),
    outreachSentAt: row.outreachSentAt?.toISOString() ?? null,
    outreachByAdminId: row.outreachByAdminId,
    importedOfferId: row.importedOfferId,
    importedAt: row.importedAt?.toISOString() ?? null,
  };
}

export async function getKeiListingDispositions(
  portalUrls: string[],
): Promise<Map<string, KeiAmerListingDisposition>> {
  await ensureKeiAmerListingStateTable();
  const normalized = [...new Set(portalUrls.map(normalizeKeiPortalUrl).filter(Boolean))];
  const out = new Map<string, KeiAmerListingDisposition>();
  if (normalized.length === 0) return out;

  const placeholders = normalized.map(() => '?').join(', ');
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT portalUrl, keiListingId, outreachSentAt, outreachByAdminId, importedOfferId, importedAt
     FROM KeiAmerListingState
     WHERE portalUrl IN (${placeholders})`,
    ...normalized,
  )) as Row[];

  for (const row of rows) {
    out.set(normalizeKeiPortalUrl(row.portalUrl), mapRow(row));
  }
  return out;
}

export async function assertKeiListingAvailableForImport(portalUrl: string): Promise<void> {
  const disposition = (await getKeiListingDispositions([portalUrl])).get(normalizeKeiPortalUrl(portalUrl));
  if (disposition?.outreachSent) {
    throw new Error('Do tego ogłoszenia wysłano już zaproszenie właściciela — import zablokowany.');
  }
}

export async function assertKeiListingAvailableForOutreach(portalUrl: string): Promise<void> {
  const normalized = normalizeKeiPortalUrl(portalUrl);
  const existing = await findExistingImportedOfferByPortalUrl(normalized);
  if (existing) {
    throw new Error(`Ogłoszenie jest już zaimportowane (oferta #${existing.id}).`);
  }
  const disposition = (await getKeiListingDispositions([normalized])).get(normalized);
  if (disposition?.importedOfferId) {
    throw new Error(`Ogłoszenie jest już zaimportowane (oferta #${disposition.importedOfferId}).`);
  }
  if (disposition?.outreachSent) {
    throw new Error('Zaproszenie do właściciela zostało już wysłane dla tego ogłoszenia.');
  }
}

export async function markKeiListingOutreachSent(options: {
  portalUrl: string;
  keiListingId?: string;
  adminUserId: number;
}): Promise<KeiAmerListingDisposition> {
  await ensureKeiAmerListingStateTable();
  const portalUrl = normalizeKeiPortalUrl(options.portalUrl);
  if (!portalUrl) throw new Error('Brak adresu portalu.');

  await assertKeiListingAvailableForOutreach(portalUrl);

  await prisma.$executeRawUnsafe(
    `INSERT INTO KeiAmerListingState (portalUrl, keiListingId, outreachSentAt, outreachByAdminId)
     VALUES (?, ?, NOW(3), ?)
     ON DUPLICATE KEY UPDATE
       keiListingId = COALESCE(VALUES(keiListingId), keiListingId),
       outreachSentAt = COALESCE(outreachSentAt, VALUES(outreachSentAt)),
       outreachByAdminId = COALESCE(outreachByAdminId, VALUES(outreachByAdminId))`,
    portalUrl,
    options.keiListingId || null,
    options.adminUserId,
  );

  const row = (await prisma.$queryRawUnsafe(
    `SELECT portalUrl, keiListingId, outreachSentAt, outreachByAdminId, importedOfferId, importedAt
     FROM KeiAmerListingState WHERE portalUrl = ? LIMIT 1`,
    portalUrl,
  )) as Row[];

  return mapRow(row[0]);
}

export async function markKeiListingImported(options: {
  portalUrl: string;
  keiListingId?: string;
  offerId: number;
}): Promise<void> {
  await ensureKeiAmerListingStateTable();
  const portalUrl = normalizeKeiPortalUrl(options.portalUrl);
  if (!portalUrl) return;

  await prisma.$executeRawUnsafe(
    `INSERT INTO KeiAmerListingState (portalUrl, keiListingId, importedOfferId, importedAt)
     VALUES (?, ?, ?, NOW(3))
     ON DUPLICATE KEY UPDATE
       keiListingId = COALESCE(VALUES(keiListingId), keiListingId),
       importedOfferId = VALUES(importedOfferId),
       importedAt = VALUES(importedAt),
       outreachSentAt = NULL,
       outreachByAdminId = NULL`,
    portalUrl,
    options.keiListingId || null,
    options.offerId,
  );
}
