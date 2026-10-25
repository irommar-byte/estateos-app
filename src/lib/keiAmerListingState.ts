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
  failCount: number;
  lastFailAt: string | null;
  lastFailReason: string | null;
  /** Ogłoszenie w przerwie po nieudanej próbie albo trwale odrzucone. */
  coolingDown: boolean;
  ignored: boolean;
  /** Zaproszenie starsze niż {@link KEI_OUTREACH_EXPIRY_DAYS} dni już nie blokuje. */
  outreachExpired: boolean;
};

/** Po tylu dniach bez odzewu zaproszenie właściciela przestaje blokować import i ponowny kontakt. */
export const KEI_OUTREACH_EXPIRY_DAYS = 21;
/** Przerwy po kolejnych nieudanych próbach importu (h). Po ostatniej — trwale pomijane. */
const FAIL_COOLDOWN_HOURS = [6, 24, 72];

export async function ensureKeiAmerListingStateTable(): Promise<void> {
  // Schema is applied by prisma/manual/sql/2026-09-09_legacy_runtime_tables.sql
  return;
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
  failCount?: number | null;
  lastFailAt?: Date | null;
  lastFailReason?: string | null;
  ignoredAt?: Date | null;
};

const SELECT_COLUMNS = `portalUrl, keiListingId, outreachSentAt, outreachByAdminId, importedOfferId, importedAt,
            failCount, lastFailAt, lastFailReason, ignoredAt`;

function isCoolingDown(failCount: number, lastFailAt: Date | null, now = Date.now()): boolean {
  if (failCount <= 0 || !lastFailAt) return false;
  if (failCount > FAIL_COOLDOWN_HOURS.length) return true;
  const hours = FAIL_COOLDOWN_HOURS[failCount - 1];
  return now - lastFailAt.getTime() < hours * 3_600_000;
}

function mapRow(row: Row): KeiAmerListingDisposition {
  const failCount = Number(row.failCount || 0);
  const lastFailAt = row.lastFailAt ? new Date(row.lastFailAt) : null;
  const outreachAt = row.outreachSentAt ? new Date(row.outreachSentAt) : null;
  const outreachExpired = Boolean(
    outreachAt && Date.now() - outreachAt.getTime() > KEI_OUTREACH_EXPIRY_DAYS * 86_400_000,
  );
  return {
    portalUrl: row.portalUrl,
    keiListingId: row.keiListingId,
    outreachSent: Boolean(outreachAt) && !outreachExpired,
    outreachSentAt: outreachAt?.toISOString() ?? null,
    outreachByAdminId: row.outreachByAdminId,
    importedOfferId: row.importedOfferId,
    importedAt: row.importedAt ? new Date(row.importedAt).toISOString() : null,
    failCount,
    lastFailAt: lastFailAt?.toISOString() ?? null,
    lastFailReason: row.lastFailReason ?? null,
    coolingDown: isCoolingDown(failCount, lastFailAt),
    ignored: Boolean(row.ignoredAt),
    outreachExpired,
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
    `SELECT ${SELECT_COLUMNS}
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
  const normalized = normalizeKeiPortalUrl(portalUrl);
  const disposition = (await getKeiListingDispositions([normalized])).get(normalized);
  if (disposition?.importedOfferId) {
    throw new Error(`Ogłoszenie jest już zaimportowane (oferta #${disposition.importedOfferId}).`);
  }
  if (disposition?.outreachSent) {
    throw new Error('Do tego ogłoszenia wysłano już zaproszenie właściciela — import zablokowany.');
  }
  if (disposition?.ignored) {
    throw new Error('Ogłoszenie oznaczone jako pomijane.');
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
       outreachSentAt = CASE
         WHEN outreachSentAt IS NULL OR outreachSentAt < DATE_SUB(NOW(3), INTERVAL ${KEI_OUTREACH_EXPIRY_DAYS} DAY)
           THEN VALUES(outreachSentAt)
         ELSE outreachSentAt
       END,
       outreachByAdminId = VALUES(outreachByAdminId)`,
    portalUrl,
    options.keiListingId || null,
    options.adminUserId,
  );

  const row = (await prisma.$queryRawUnsafe(
    `SELECT ${SELECT_COLUMNS}
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
       outreachByAdminId = NULL,
       failCount = 0,
       lastFailAt = NULL,
       lastFailReason = NULL`,
    portalUrl,
    options.keiListingId || null,
    options.offerId,
  );
}

/** Nieudana próba importu — kolejne próby dopiero po przerwie (6 h → 24 h → 72 h → trwale). */
export async function markKeiListingFailed(options: {
  portalUrl: string;
  keiListingId?: string;
  reason: string;
}): Promise<void> {
  const portalUrl = normalizeKeiPortalUrl(options.portalUrl);
  if (!portalUrl) return;
  await prisma.$executeRawUnsafe(
    `INSERT INTO KeiAmerListingState (portalUrl, keiListingId, failCount, lastFailAt, lastFailReason)
     VALUES (?, ?, 1, NOW(3), ?)
     ON DUPLICATE KEY UPDATE
       keiListingId = COALESCE(VALUES(keiListingId), keiListingId),
       failCount = failCount + 1,
       lastFailAt = NOW(3),
       lastFailReason = VALUES(lastFailReason)`,
    portalUrl,
    options.keiListingId || null,
    String(options.reason || '').slice(0, 500),
  );
}

/** Cofnięcie zaproszenia (np. wiadomość nie została wysłana) — ogłoszenie wraca do puli. */
export async function revokeKeiListingOutreach(portalUrl: string): Promise<void> {
  const normalized = normalizeKeiPortalUrl(portalUrl);
  if (!normalized) return;
  await prisma.$executeRawUnsafe(
    `UPDATE KeiAmerListingState SET outreachSentAt = NULL, outreachByAdminId = NULL WHERE portalUrl = ?`,
    normalized,
  );
}

/** Ręczne pominięcie ogłoszenia (np. agencja udająca właściciela) lub jego przywrócenie. */
export async function setKeiListingIgnored(portalUrl: string, ignored: boolean, keiListingId?: string): Promise<void> {
  const normalized = normalizeKeiPortalUrl(portalUrl);
  if (!normalized) return;
  await prisma.$executeRawUnsafe(
    `INSERT INTO KeiAmerListingState (portalUrl, keiListingId, ignoredAt)
     VALUES (?, ?, ${ignored ? 'NOW(3)' : 'NULL'})
     ON DUPLICATE KEY UPDATE ignoredAt = ${ignored ? 'NOW(3)' : 'NULL'},
       failCount = ${ignored ? 'failCount' : '0'}`,
    normalized,
    keiListingId || null,
  );
}
