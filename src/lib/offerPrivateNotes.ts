import { prisma } from '@/lib/prisma';
import type { OtodomImportDraft } from '@/lib/otodomImport';

const SOURCE_CHECK_MAX_AGE_MS = 1000 * 60 * 60 * 24;
const SOURCE_CHECK_TIMEOUT_MS = 12_000;

export type OfferPrivateNoteRow = {
  offerId: number;
  userId: number;
  userNote: string;
  importSource: string | null;
  importExternalUrl: string | null;
  importExternalId: string | null;
  importSnapshotJson: string | null;
  sourceIsActive: number | null;
  sourceLastCheckAt: Date | null;
  sourceLastHttpStatus: number | null;
  sourceLastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '{}';
  }
}

export async function ensureOfferPrivateNoteTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS OfferPrivateNote (
      id BIGINT NOT NULL AUTO_INCREMENT,
      offerId INT NOT NULL,
      userId INT NOT NULL,
      userNote TEXT NULL,
      importSource VARCHAR(64) NULL,
      importExternalUrl TEXT NULL,
      importExternalId VARCHAR(64) NULL,
      importSnapshotJson LONGTEXT NULL,
      sourceIsActive TINYINT(1) NULL,
      sourceLastCheckAt DATETIME(3) NULL,
      sourceLastHttpStatus INT NULL,
      sourceLastError VARCHAR(512) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY OfferPrivateNote_offerId_userId_key (offerId, userId),
      KEY OfferPrivateNote_offerId_idx (offerId),
      KEY OfferPrivateNote_userId_idx (userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

export async function upsertImportedOfferPrivateSnapshot(params: {
  offerId: number;
  userId: number;
  draft: OtodomImportDraft;
}) {
  await ensureOfferPrivateNoteTable();
  const draft = params.draft;
  const importSummary = {
    source: draft.source,
    externalUrl: draft.externalUrl,
    externalId: draft.externalId,
    titleOriginal: draft.title,
    descriptionOriginalHtml: draft.descriptionHtml,
    descriptionOriginalText: draft.descriptionText,
    agency: draft.agency,
    advertiserType: draft.advertiserType,
    status: draft.status,
    createdAt: draft.createdAt,
    modifiedAt: draft.modifiedAt,
    contactHints: {
      agencyName: draft.agency?.name || null,
      phone: draft.agency?.phone || null,
      address: draft.agency?.address || null,
    },
    nonMappedFields: {
      features: draft.features,
      characteristics: draft.characteristics,
      locationWarnings: draft.locationWarnings,
    },
    fullDraft: draft,
  };

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO OfferPrivateNote
      (offerId, userId, userNote, importSource, importExternalUrl, importExternalId, importSnapshotJson)
      VALUES (?, ?, '', ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        importSource = VALUES(importSource),
        importExternalUrl = VALUES(importExternalUrl),
        importExternalId = VALUES(importExternalId),
        importSnapshotJson = VALUES(importSnapshotJson);
    `,
    params.offerId,
    params.userId,
    draft.source,
    draft.externalUrl || null,
    String(draft.externalId || ''),
    safeJsonStringify(importSummary),
  );
}

export async function getOfferPrivateNote(offerId: number, userId: number): Promise<OfferPrivateNoteRow | null> {
  await ensureOfferPrivateNoteTable();
  const rows = await prisma.$queryRawUnsafe<OfferPrivateNoteRow[]>(
    `
      SELECT
        offerId,
        userId,
        COALESCE(userNote, '') AS userNote,
        importSource,
        importExternalUrl,
        importExternalId,
        importSnapshotJson,
        sourceIsActive,
        sourceLastCheckAt,
        sourceLastHttpStatus,
        sourceLastError,
        createdAt,
        updatedAt
      FROM OfferPrivateNote
      WHERE offerId = ? AND userId = ?
      LIMIT 1
    `,
    offerId,
    userId,
  );
  return rows[0] ?? null;
}

export async function saveOfferPrivateUserNote(params: {
  offerId: number;
  userId: number;
  userNote: string;
}) {
  await ensureOfferPrivateNoteTable();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO OfferPrivateNote (offerId, userId, userNote)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE userNote = VALUES(userNote)
    `,
    params.offerId,
    params.userId,
    params.userNote,
  );
}

export async function refreshOfferSourceStatusIfStale(offerId: number, userId: number) {
  const row = await getOfferPrivateNote(offerId, userId);
  if (!row?.importExternalUrl) return row;

  const lastCheckMs = row.sourceLastCheckAt ? new Date(row.sourceLastCheckAt).getTime() : 0;
  const isStale = !lastCheckMs || Date.now() - lastCheckMs >= SOURCE_CHECK_MAX_AGE_MS;
  if (!isStale) return row;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_CHECK_TIMEOUT_MS);
  let status: number | null = null;
  let isActive = 0;
  let errorText: string | null = null;
  try {
    const res = await fetch(row.importExternalUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      cache: 'no-store',
      redirect: 'follow',
    });
    status = res.status;
    isActive = res.ok ? 1 : 0;
  } catch (error) {
    status = null;
    isActive = 0;
    errorText = error instanceof Error ? error.message.slice(0, 500) : 'UNKNOWN_ERROR';
  } finally {
    clearTimeout(timer);
  }

  await prisma.$executeRawUnsafe(
    `
      UPDATE OfferPrivateNote
      SET sourceIsActive = ?, sourceLastCheckAt = NOW(3), sourceLastHttpStatus = ?, sourceLastError = ?
      WHERE offerId = ? AND userId = ?
    `,
    isActive,
    status,
    errorText,
    offerId,
    userId,
  );

  return getOfferPrivateNote(offerId, userId);
}
