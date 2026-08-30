import { prisma } from '@/lib/prisma';
import { ensureOfferPrivateNoteTable } from '@/lib/offerPrivateNotes';
import { ensureIntelligenceAmenityPatchesColumn } from '@/lib/intelligenceAmenityPatches';
import {
  appliedIntelligenceAmenityFields,
  intelligenceAmenityLabel,
  parseAmenityPatchMap,
} from '@/lib/intelligenceAmenityBrain';
import { shapeOfferPrivateNoteView } from '@/lib/offerPrivateNoteView';
import { importPortalBadge, type ImportPortalBadge } from '@/lib/crm/importPortalBadge';

export type MatchImportBrief = {
  badge: ImportPortalBadge | null;
  source: string | null;
  url: string | null;
  titleOriginal: string | null;
  descriptionOriginal: string | null;
  phone: string | null;
  agencyName: string | null;
  contactAddress: string | null;
  advertiserType: string | null;
  smartAdd: string[];
  userNote: string | null;
};

type RawImportRow = {
  offerId: number;
  importSource: string | null;
  importExternalUrl: string | null;
  importSnapshotJson: string | null;
  userNote: string | null;
  intelligenceAmenityPatches: unknown;
  description: string | null;
};

function briefFromRow(row: RawImportRow): MatchImportBrief {
  const view = shapeOfferPrivateNoteView(row.importSnapshotJson);
  const smart = appliedIntelligenceAmenityFields(parseAmenityPatchMap(row.intelligenceAmenityPatches)).map(
    (field) => intelligenceAmenityLabel(field),
  );
  const url = String(row.importExternalUrl || '').trim() || null;
  return {
    badge: importPortalBadge(row.importSource, url, row.description),
    source: String(row.importSource || '').trim() || null,
    url,
    titleOriginal: view.titleOriginal,
    descriptionOriginal: view.descriptionOriginalText
      ? view.descriptionOriginalText.replace(/\s+/g, ' ').trim().slice(0, 900)
      : null,
    phone: view.phone,
    agencyName: view.agencyName,
    contactAddress: view.contactAddress || view.keiAddress,
    advertiserType: view.advertiserType,
    smartAdd: smart,
    userNote: String(row.userNote || '').trim() || null,
  };
}

export async function listMatchImportBriefs(offerIds: number[]): Promise<Map<number, MatchImportBrief>> {
  const ids = [...new Set(offerIds.filter((id) => Number.isFinite(id) && id > 0))];
  const map = new Map<number, MatchImportBrief>();
  if (!ids.length) return map;

  await ensureOfferPrivateNoteTable();
  await ensureIntelligenceAmenityPatchesColumn();
  const placeholders = ids.map(() => '?').join(',');
  const rows = await prisma.$queryRawUnsafe<RawImportRow[]>(
    `
      SELECT
        o.id AS offerId,
        opn.importSource,
        opn.importExternalUrl,
        opn.importSnapshotJson,
        opn.userNote,
        o.intelligenceAmenityPatches,
        o.description
      FROM Offer o
      LEFT JOIN OfferPrivateNote opn ON opn.offerId = o.id
      WHERE o.id IN (${placeholders})
    `,
    ...ids,
  );

  for (const row of rows) {
    const brief = briefFromRow({
      ...row,
      offerId: Number(row.offerId),
    });
    if (brief.badge || brief.url || brief.descriptionOriginal || brief.phone || brief.smartAdd.length || brief.userNote) {
      map.set(Number(row.offerId), brief);
    }
  }
  return map;
}

export function attachMatchImportBrief<T extends { offer: { id: number } }>(
  matches: T[],
  briefs: Map<number, MatchImportBrief>,
): Array<T & { importBrief: MatchImportBrief | null }> {
  return matches.map((row) => ({
    ...row,
    importBrief: briefs.get(row.offer.id) || null,
  }));
}
