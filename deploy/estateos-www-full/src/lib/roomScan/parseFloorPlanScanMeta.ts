import type {
  FloorPlanScanMeta,
  PropertyRoomScan,
  RoomScanDetectedObject,
  RoomScanOpening,
  RoomScanSection,
  RoomScanWallSegment,
} from '@/types/roomScan';
import { listingRoomCountFromRooms, listingRoomCountFromSections, refineScanSections, totalUniqueAreaSqM } from '@/lib/roomScan/refineScanSections';

function asNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function stripNestedRoomScans(raw: unknown): unknown {
  if (!raw) return raw;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return raw;
    const { roomScans: _ignored, ...rest } = parsed as Record<string, unknown>;
    return rest;
  } catch {
    return raw;
  }
}

function parseRooms(raw: unknown): PropertyRoomScan[] {
  if (!Array.isArray(raw)) return [];
  const rooms: PropertyRoomScan[] = [];
  raw.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const room = item as Record<string, unknown>;
    rooms.push({
      id: String(room.id || `room-${index}`),
      name: String(room.name || `Pomieszczenie ${index + 1}`),
      typeKey: room.typeKey ? String(room.typeKey) : undefined,
      sourceSectionIndex: Number.isFinite(Number(room.sourceSectionIndex))
        ? Number(room.sourceSectionIndex)
        : undefined,
      widthM: String(room.widthM || ''),
      lengthM: String(room.lengthM || ''),
      heightM: String(room.heightM || ''),
      areaM2: String(room.areaM2 || ''),
      floorPlanPngUri: room.floorPlanPngUri ? String(room.floorPlanPngUri) : undefined,
      floorPlan3dUri: room.floorPlan3dUri ? String(room.floorPlan3dUri) : undefined,
      scanMeta: room.scanMeta
        ? parseFloorPlanScanMeta(stripNestedRoomScans(room.scanMeta)) || undefined
        : undefined,
      scannedAt: room.scannedAt ? String(room.scannedAt) : undefined,
    });
  });
  return rooms;
}

export function parseFloorPlanScanMeta(raw: unknown): FloorPlanScanMeta | null {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return null;
    const meta = parsed as Partial<FloorPlanScanMeta> & Record<string, unknown>;
    const roomScans = parseRooms(meta.roomScans);
    const walls = Array.isArray(meta.walls) ? (meta.walls as RoomScanWallSegment[]) : [];
    const sections = Array.isArray(meta.sections) ? (meta.sections as RoomScanSection[]) : [];
    const objects = Array.isArray(meta.objects) ? (meta.objects as RoomScanDetectedObject[]) : [];
    const openings = Array.isArray(meta.openings) ? (meta.openings as RoomScanOpening[]) : [];
    const hasPlan = walls.length > 0 || sections.length > 0 || objects.length > 0 || roomScans.length > 0;
    if (!hasPlan) return null;

    const bounds = meta.bounds && typeof meta.bounds === 'object'
      ? (meta.bounds as FloorPlanScanMeta['bounds'])
      : { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };

    const refined = walls.length
      ? refineScanSections(sections, walls, objects, asNumber(meta.ceilingHeightM) ?? null)
      : sections;
    const listingCount =
      listingRoomCountFromSections(refined) || listingRoomCountFromRooms(roomScans);

    return {
      version: meta.version === 1 ? 1 : 2,
      scannedAt: String(meta.scannedAt || ''),
      roomCount: listingCount || Number(meta.roomCount) || Math.max(refined.length, roomScans.length, 0),
      totalAreaSqM:
        walls.length
          ? totalUniqueAreaSqM(refined, walls)
          : meta.totalAreaSqM != null && Number.isFinite(Number(meta.totalAreaSqM))
            ? Number(meta.totalAreaSqM)
            : null,
      ceilingHeightM: asNumber(meta.ceilingHeightM) ?? null,
      sections: refined,
      walls,
      objects,
      openings,
      bounds,
      northRotationDegrees: asNumber(meta.northRotationDegrees) ?? null,
      headingAccuracyDegrees: asNumber(meta.headingAccuracyDegrees) ?? null,
      headingSource:
        meta.headingSource === 'true' || meta.headingSource === 'magnetic' ? meta.headingSource : null,
      roomScans: roomScans.length ? roomScans : undefined,
      roomAreaTotalSqM: asNumber(meta.roomAreaTotalSqM),
    };
  } catch {
    return null;
  }
}

export function resolvePublicAssetUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (typeof window !== 'undefined') {
    return trimmed.startsWith('/') ? `${window.location.origin}${trimmed}` : `${window.location.origin}/${trimmed}`;
  }
  return trimmed;
}
