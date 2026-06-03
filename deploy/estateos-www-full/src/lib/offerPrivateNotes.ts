import { prisma } from '@/lib/prisma';
import type { OtodomImportDraft } from '@/lib/otodomImport';

const IMPORT_MARKER_RE =
  /<!--\s*estateos-(otodom|olx|nieruchomosci-online):(\d+)\s*-->/i;

function parseImportMarkerFromDescription(description: string): {
  source: 'OTODOM' | 'OLX' | 'NIERUCHOMOSCI_ONLINE';
  externalId: number;
} | null {
  const match = String(description || '').match(IMPORT_MARKER_RE);
  if (!match) return null;
  const sourceRaw = String(match[1] || '').toLowerCase();
  const externalId = Number(match[2]);
  if (!Number.isFinite(externalId) || externalId <= 0) return null;
  if (sourceRaw === 'olx') return { source: 'OLX', externalId };
  if (sourceRaw === 'nieruchomosci-online') {
    return { source: 'NIERUCHOMOSCI_ONLINE', externalId };
  }
  return { source: 'OTODOM', externalId };
}

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

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
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

/** Uzupełnia brakującą notatkę importu na podstawie markera w opisie oferty. */
export async function repairImportPrivateNoteFromOffer(
  offerId: number,
  userId: number,
): Promise<OfferPrivateNoteRow | null> {
  const existing = await getOfferPrivateNote(offerId, userId);
  if (existing?.importSnapshotJson && existing.importExternalUrl) {
    return existing;
  }

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, userId: true, title: true, description: true },
  });
  if (!offer || Number(offer.userId) !== Number(userId)) return existing;

  const marker = parseImportMarkerFromDescription(String(offer.description || ''));
  if (!marker) return existing;

  const sourceLabels: Record<string, string> = {
    OTODOM: 'OTODOM',
    OLX: 'OLX',
    NIERUCHOMOSCI_ONLINE: 'NIERUCHOMOSCI_ONLINE',
  };

  const importSummary = {
    source: marker.source,
    externalUrl: null as string | null,
    externalId: marker.externalId,
    titleOriginal: String(offer.title || '').trim(),
    descriptionOriginalHtml: String(offer.description || ''),
    descriptionOriginalText: stripHtml(String(offer.description || '')),
    repairedFromMarker: true,
  };

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO OfferPrivateNote
      (offerId, userId, userNote, importSource, importExternalUrl, importExternalId, importSnapshotJson)
      VALUES (?, ?, COALESCE((SELECT userNote FROM OfferPrivateNote WHERE offerId = ? AND userId = ? LIMIT 1), ''), ?, NULL, ?, ?)
      ON DUPLICATE KEY UPDATE
        importSource = COALESCE(VALUES(importSource), importSource),
        importExternalId = COALESCE(VALUES(importExternalId), importExternalId),
        importSnapshotJson = COALESCE(VALUES(importSnapshotJson), importSnapshotJson);
    `,
    offerId,
    userId,
    offerId,
    userId,
    sourceLabels[marker.source] || marker.source,
    String(marker.externalId),
    safeJsonStringify(importSummary),
  );

  return getOfferPrivateNote(offerId, userId);
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
  let snapshotNeedsHydration = false;
  if (String(row.importSource || '') === 'NIERUCHOMOSCI_ONLINE' && row.importSnapshotJson) {
    try {
      const parsed = JSON.parse(row.importSnapshotJson) as Record<string, unknown>;
      const contactHints = (parsed.contactHints ?? {}) as Record<string, unknown>;
      const hasName = Boolean(String(contactHints.agencyName || '').trim());
      const descriptionLen = String(parsed.descriptionOriginalText || '').trim().length;
      snapshotNeedsHydration = !hasName || descriptionLen < 250;
    } catch {
      snapshotNeedsHydration = true;
    }
  }
  const isStale = !lastCheckMs || Date.now() - lastCheckMs >= SOURCE_CHECK_MAX_AGE_MS || snapshotNeedsHydration;
  if (!isStale) return row;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_CHECK_TIMEOUT_MS);
  let status: number | null = null;
  let isActive = 0;
  let errorText: string | null = null;
  let refreshedSnapshotJson: string | null = null;
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
    if (res.ok) {
      const html = await res.text();
      if (String(row.importSource || '') === 'NIERUCHOMOSCI_ONLINE') {
        let parsed: Record<string, unknown> = {};
        if (row.importSnapshotJson) {
          try {
            parsed = JSON.parse(row.importSnapshotJson) as Record<string, unknown>;
          } catch {
            parsed = {};
          }
        }
        const contactNameMatch = html.match(
          /<div class="box-agent-mini"[\s\S]*?<p class="name"[^>]*>([^<]+)<\/p>/i,
        );
        const contactScope = html.match(/<div class="box-agent-mini"[\s\S]*?<\/div>\s*<\/div>/i)?.[0] ?? html;
        const fullPhoneMatch = contactScope.match(/(?:\+48[\s-]*)?\d{3}[\s-]?\d{3}[\s-]?\d{3}/);
        const maskedPhoneMatch = contactScope.match(/(?:\+48[\s-]*)?\d{3}[\s-]?\d{3}\s*\.\.\./);
        const phoneFromJsonMasked = html.match(/"phoneHDots":"([^"]+)"/i);
        const descMoreMatch = html.match(
          /<div class="estate-desc-more"[^>]*>\s*<p class="body-md">([\s\S]*?)<\/p>\s*<\/div>/i,
        );
        const descLessMatch = html.match(
          /<div class="estate-desc-less"[^>]*>\s*<p class="body-md">([\s\S]*?)<\/p>/i,
        );
        const fullDescHtml = decodeHtmlEntities(
          String(descMoreMatch?.[1] ?? descLessMatch?.[1] ?? parsed.descriptionOriginalHtml ?? ''),
        ).trim();
        const contactHints = {
          agencyName: contactNameMatch
            ? decodeHtmlEntities(String(contactNameMatch[1])).trim()
            : String((parsed.contactHints as Record<string, unknown> | undefined)?.agencyName || ''),
          phone: fullPhoneMatch?.[0]
            ? fullPhoneMatch[0].replace(/\s{2,}/g, ' ').trim()
            : maskedPhoneMatch?.[0]
              ? maskedPhoneMatch[0].replace(/\s{2,}/g, ' ').trim()
              : phoneFromJsonMasked
                ? decodeHtmlEntities(phoneFromJsonMasked[1]).trim()
                : String((parsed.contactHints as Record<string, unknown> | undefined)?.phone || ''),
          address: String((parsed.contactHints as Record<string, unknown> | undefined)?.address || ''),
        };
        const merged = {
          ...parsed,
          descriptionOriginalHtml: fullDescHtml || parsed.descriptionOriginalHtml || '',
          descriptionOriginalText: fullDescHtml ? stripHtml(fullDescHtml) : parsed.descriptionOriginalText || '',
          contactHints,
        };
        refreshedSnapshotJson = safeJsonStringify(merged);
      }
    }
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
      SET sourceIsActive = ?, sourceLastCheckAt = NOW(3), sourceLastHttpStatus = ?, sourceLastError = ?,
          importSnapshotJson = COALESCE(?, importSnapshotJson)
      WHERE offerId = ? AND userId = ?
    `,
    isActive,
    status,
    errorText,
    refreshedSnapshotJson,
    offerId,
    userId,
  );

  return getOfferPrivateNote(offerId, userId);
}
