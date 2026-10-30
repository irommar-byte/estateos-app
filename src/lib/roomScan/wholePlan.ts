import type { FloorPlanScanMeta, PropertyRoomScan } from '../../types/roomScan';
import { assembleRoomScans } from './assembleRooms';

/**
 * Plan całości: skan całego mieszkania, a gdy go nie ma — plan złożony z osobnych skanów pokoi
 * (tylko gdy dopasowanie drzwi jest pewne; inaczej zostaje zestawienie pokoi).
 */
export function resolveWholePlanMeta(
  meta: FloorPlanScanMeta | null | undefined,
): { meta: FloorPlanScanMeta | null; assembled: boolean } {
  if (!meta) return { meta: null, assembled: false };
  if (meta.walls?.length) return { meta, assembled: false };
  const rooms = (meta.roomScans || []) as PropertyRoomScan[];
  const inputs = rooms
    .filter((room) => room.scanMeta?.walls?.length)
    .map((room) => ({
      name: room.name,
      key: room.typeKey,
      area: Number(String(room.areaM2 || '').replace(',', '.')) || undefined,
      meta: room.scanMeta as FloorPlanScanMeta,
    }));
  if (inputs.length < 2) return { meta, assembled: false };
  try {
    const result = assembleRoomScans(inputs);
    if (!result || result.placed < result.total || result.confidence < 0.6) return { meta, assembled: false };
    return {
      meta: { ...meta, ...result.meta, roomScans: meta.roomScans, roomAreaTotalSqM: meta.roomAreaTotalSqM },
      assembled: true,
    };
  } catch {
    return { meta, assembled: false };
  }
}
