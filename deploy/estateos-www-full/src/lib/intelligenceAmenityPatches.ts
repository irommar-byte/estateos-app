import { prisma } from '@/lib/prisma';
import {
  reapplyAmenityPatch,
  undoAmenityPatch,
  type IntelligenceAmenityField,
  type IntelligenceAmenityPatchMap,
  parseAmenityPatchMap,
} from '@/lib/intelligenceAmenityBrain';

let patchesColumnReady: Promise<void> | null = null;

export async function ensureIntelligenceAmenityPatchesColumn(): Promise<void> {
  if (!patchesColumnReady) {
    patchesColumnReady = prisma
      .$executeRawUnsafe(
        `ALTER TABLE \`Offer\` ADD COLUMN \`intelligenceAmenityPatches\` JSON NULL`,
      )
      .then(() => undefined)
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        if (!/Duplicate column|exists/i.test(message)) {
          patchesColumnReady = null;
          throw error;
        }
      });
  }
  await patchesColumnReady;
}

export async function readOfferAmenityPatches(offerId: number): Promise<IntelligenceAmenityPatchMap> {
  await ensureIntelligenceAmenityPatchesColumn();
  const rows = await prisma.$queryRawUnsafe<Array<{ intelligenceAmenityPatches: unknown }>>(
    `SELECT intelligenceAmenityPatches FROM Offer WHERE id = ? LIMIT 1`,
    offerId,
  );
  return parseAmenityPatchMap(rows[0]?.intelligenceAmenityPatches);
}

export async function writeOfferAmenityPatches(
  offerId: number,
  map: IntelligenceAmenityPatchMap,
): Promise<void> {
  await ensureIntelligenceAmenityPatchesColumn();
  await prisma.$executeRawUnsafe(
    `UPDATE Offer SET intelligenceAmenityPatches = ? WHERE id = ?`,
    JSON.stringify(map),
    offerId,
  );
}

export function amenityFieldData(field: IntelligenceAmenityField, value: boolean): Record<string, boolean> {
  return { [field]: value };
}

export async function toggleOfferAmenityPatch(
  offerId: number,
  field: IntelligenceAmenityField,
  action: 'undo' | 'reapply',
): Promise<IntelligenceAmenityPatchMap> {
  const map = await readOfferAmenityPatches(offerId);
  const next = action === 'undo' ? undoAmenityPatch(map, field) : reapplyAmenityPatch(map, field);
  await writeOfferAmenityPatches(offerId, next);
  await prisma.offer.update({
    where: { id: offerId },
    data: amenityFieldData(field, action === 'reapply'),
  });
  return next;
}
