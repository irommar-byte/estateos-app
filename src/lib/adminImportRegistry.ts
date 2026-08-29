import { prisma } from '@/lib/prisma';
import { ensureOfferPrivateNoteTable } from '@/lib/offerPrivateNotes';
import { ensureIntelligenceAmenityPatchesColumn } from '@/lib/intelligenceAmenityPatches';
import {
  appliedIntelligenceAmenityFields,
  intelligenceAmenityLabel,
  parseAmenityPatchMap,
} from '@/lib/intelligenceAmenityBrain';

export type ImportRegistryRow = {
  offerId: number;
  offerTitle: string;
  offerStatus: string;
  offerCreatedAt: string;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  importSource: string;
  importExternalUrl: string | null;
  importExternalId: string | null;
  importedAt: string | null;
  sourceIsActive: boolean | null;
  sourceLastCheckAt: string | null;
  smartAddFields: string[];
  smartAddSummary: string | null;
  keiId: string | null;
};

type RawRow = {
  offerId: number;
  userId: number;
  importSource: string | null;
  importExternalUrl: string | null;
  importExternalId: string | null;
  importSnapshotJson: string | null;
  sourceIsActive: number | boolean | null;
  sourceLastCheckAt: Date | string | null;
  updatedAt: Date | string;
  title: string | null;
  status: string | null;
  createdAt: Date | string;
  intelligenceAmenityPatches: unknown;
  userName: string | null;
  userEmail: string | null;
};

function parseImportedAt(snapshotJson: string | null): string | null {
  if (!snapshotJson) return null;
  try {
    const parsed = JSON.parse(snapshotJson) as Record<string, unknown>;
    const imp = parsed.import as Record<string, unknown> | undefined;
    const at = String(imp?.importedAt || '').trim();
    return at || null;
  } catch {
    return null;
  }
}

function parseKeiId(snapshotJson: string | null): string | null {
  if (!snapshotJson) return null;
  try {
    const parsed = JSON.parse(snapshotJson) as Record<string, unknown>;
    const kei = parsed.kei as Record<string, unknown> | undefined;
    const id = String(kei?.id || '').trim();
    return id || null;
  } catch {
    return null;
  }
}

function smartAddFromPatches(raw: unknown): { fields: string[]; summary: string | null } {
  const map = parseAmenityPatchMap(raw);
  const fields = appliedIntelligenceAmenityFields(map).map((field) => intelligenceAmenityLabel(field));
  return {
    fields,
    summary: fields.length ? fields.join(', ') : null,
  };
}

function mapRow(row: RawRow): ImportRegistryRow {
  const smart = smartAddFromPatches(row.intelligenceAmenityPatches);
  return {
    offerId: Number(row.offerId),
    offerTitle: String(row.title || `Oferta #${row.offerId}`),
    offerStatus: String(row.status || 'UNKNOWN'),
    offerCreatedAt: new Date(row.createdAt).toISOString(),
    userId: Number(row.userId),
    userName: row.userName,
    userEmail: row.userEmail,
    importSource: String(row.importSource || ''),
    importExternalUrl: row.importExternalUrl,
    importExternalId: row.importExternalId,
    importedAt: parseImportedAt(row.importSnapshotJson) || new Date(row.updatedAt).toISOString(),
    sourceIsActive: row.sourceIsActive == null ? null : Boolean(row.sourceIsActive),
    sourceLastCheckAt: row.sourceLastCheckAt ? new Date(row.sourceLastCheckAt).toISOString() : null,
    smartAddFields: smart.fields,
    smartAddSummary: smart.summary,
    keiId: parseKeiId(row.importSnapshotJson),
  };
}

export async function listImportRegistry(params: {
  limit?: number;
  offset?: number;
  source?: string | null;
}): Promise<{ rows: ImportRegistryRow[]; total: number }> {
  await ensureOfferPrivateNoteTable();
  await ensureIntelligenceAmenityPatchesColumn();

  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const offset = Math.max(params.offset ?? 0, 0);
  const source = String(params.source || '').trim().toUpperCase();

  const whereSource = source ? 'AND UPPER(opn.importSource) = ?' : '';
  const countParams = source ? [source] : [];
  const listParams = source ? [source, limit, offset] : [limit, offset];

  const countRows = (await prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(
    `
      SELECT COUNT(*) AS total
      FROM OfferPrivateNote opn
      WHERE opn.importSource IS NOT NULL
        AND TRIM(opn.importSource) <> ''
        ${whereSource}
    `,
    ...countParams,
  )) as Array<{ total: bigint | number }>;

  const rows = (await prisma.$queryRawUnsafe(
    `
      SELECT
        opn.offerId,
        opn.userId,
        opn.importSource,
        opn.importExternalUrl,
        opn.importExternalId,
        opn.importSnapshotJson,
        opn.sourceIsActive,
        opn.sourceLastCheckAt,
        opn.updatedAt,
        o.title,
        o.status,
        o.createdAt,
        o.intelligenceAmenityPatches,
        u.name AS userName,
        u.email AS userEmail
      FROM OfferPrivateNote opn
      JOIN Offer o ON o.id = opn.offerId
      JOIN User u ON u.id = opn.userId
      WHERE opn.importSource IS NOT NULL
        AND TRIM(opn.importSource) <> ''
        ${whereSource}
      ORDER BY opn.updatedAt DESC
      LIMIT ? OFFSET ?
    `,
    ...listParams,
  )) as RawRow[];

  return {
    rows: rows.map(mapRow),
    total: Number(countRows[0]?.total ?? 0),
  };
}
