import type { FloorPlanScanMeta, RoomScanSection, RoomScanWallSegment } from '../../types/roomScan';
import {
  dedupeRoomSections,
  dedupeWallSegments,
  estimateFloorAreaFromWalls,
  wallLengthMeters,
} from './floorPlanGeometry';
import { getRoomScanSectionLabel } from './roomScanLabels';

type SurfaceLike = {
  dimensions?: number[];
  transform?: number[];
  category?: Record<string, unknown>;
};

type SectionLike = {
  label?: unknown;
  center?: number[];
  story?: number;
};

type RoomLike = {
  walls?: SurfaceLike[];
  sections?: SectionLike[];
};

function wallSegmentFromSurface(surface: SurfaceLike): RoomScanWallSegment | null {
  const width = Number(surface.dimensions?.[0] || 0);
  const transform = surface.transform;
  if (!width || !transform || transform.length < 16) return null;

  const cx = transform[12];
  const cz = transform[14];
  const dirX = transform[0];
  const dirZ = transform[2];
  const half = width / 2;

  return {
    x1: cx - dirX * half,
    z1: cz - dirZ * half,
    x2: cx + dirX * half,
    z2: cz + dirZ * half,
    lengthM: width,
  };
}

function sectionLabel(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return getRoomScanSectionLabel('unspecified');
  const key = Object.keys(raw as Record<string, unknown>)[0] || 'unspecified';
  return getRoomScanSectionLabel(key);
}

function sectionKey(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return 'unspecified';
  return Object.keys(raw as Record<string, unknown>)[0] || 'unspecified';
}

function sectionFromRaw(section: SectionLike): RoomScanSection | null {
  const center = section.center;
  if (!Array.isArray(center) || center.length < 3) return null;
  return {
    key: sectionKey(section.label),
    label: sectionLabel(section.label),
    centerX: center[0],
    centerZ: center[2],
  };
}


function roomWallsFingerprint(walls: RoomScanWallSegment[]): string {
  return dedupeWallSegments(walls)
    .map((w) => {
      const len = wallLengthMeters(w).toFixed(2);
      const ax = Math.min(w.x1, w.x2).toFixed(1);
      const az = Math.min(w.z1, w.z2).toFixed(1);
      return `${len}@${ax},${az}`;
    })
    .sort()
    .join('|');
}

function collectSections(payload: unknown): RoomScanSection[] {
  const root = payload as {
    sections?: SectionLike[];
    rooms?: RoomLike[];
  };

  const collected: RoomScanSection[] = [];
  const seenRoomPrints = new Set<string>();

  if (Array.isArray(root.rooms) && root.rooms.length > 0) {
    for (const room of root.rooms) {
      const roomWalls = Array.isArray(room.walls)
        ? dedupeWallSegments(
            room.walls.map(wallSegmentFromSurface).filter((s): s is RoomScanWallSegment => Boolean(s)),
          )
        : [];
      if (roomWalls.length) {
        const fingerprint = roomWallsFingerprint(roomWalls);
        if (seenRoomPrints.has(fingerprint)) continue;
        seenRoomPrints.add(fingerprint);
      }
      const roomFootprint = roomWalls.length ? estimateFloorAreaFromWalls(roomWalls) : 0;
      const roomSections = Array.isArray(room.sections)
        ? room.sections.map(sectionFromRaw).filter((s): s is RoomScanSection => Boolean(s))
        : [];

      if (roomSections.length) {
        const perSectionArea =
          roomFootprint > 0 ? Number((roomFootprint / roomSections.length).toFixed(1)) : undefined;
        for (const section of roomSections) {
          collected.push({
            ...section,
            areaSqM: section.areaSqM ?? perSectionArea,
          });
        }
        continue;
      }

      if (roomWalls.length) {
        const xs = roomWalls.flatMap((w) => [w.x1, w.x2]);
        const zs = roomWalls.flatMap((w) => [w.z1, w.z2]);
        collected.push({
          key: 'unspecified',
          label: getRoomScanSectionLabel('unspecified'),
          centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
          centerZ: (Math.min(...zs) + Math.max(...zs)) / 2,
          areaSqM: Number(roomFootprint.toFixed(1)),
        });
      }
    }
  } else if (Array.isArray(root.sections)) {
    for (const section of root.sections) {
      const parsed = sectionFromRaw(section);
      if (parsed) collected.push(parsed);
    }
  }

  return dedupeRoomSections(collected, 0.95);
}

export function extractWallSegments(payload: unknown): RoomScanWallSegment[] {
  const root = payload as { walls?: SurfaceLike[]; rooms?: RoomLike[] };
  const walls: SurfaceLike[] = [];

  if (Array.isArray(root.walls)) walls.push(...root.walls);
  if (Array.isArray(root.rooms)) {
    for (const room of root.rooms) {
      if (Array.isArray(room.walls)) walls.push(...room.walls);
    }
  }

  return dedupeWallSegments(
    walls.map(wallSegmentFromSurface).filter((s): s is RoomScanWallSegment => Boolean(s)),
  );
}

export function buildFloorPlanScanMeta(payload: unknown): FloorPlanScanMeta {
  const sections = collectSections(payload);
  const walls = extractWallSegments(payload);

  const xs = walls.flatMap((w) => [w.x1, w.x2]);
  const zs = walls.flatMap((w) => [w.z1, w.z2]);
  const sectionXs = sections.map((s) => s.centerX);
  const sectionZs = sections.map((s) => s.centerZ);

  const allX = xs.length ? xs.concat(sectionXs) : sectionXs;
  const allZ = zs.length ? zs.concat(sectionZs) : sectionZs;

  const minX = allX.length ? Math.min(...allX) : -2;
  const maxX = allX.length ? Math.max(...allX) : 2;
  const minZ = allZ.length ? Math.min(...allZ) : -2;
  const maxZ = allZ.length ? Math.max(...allZ) : 2;

  const pad = 0.75;
  const totalFootprint = estimateFloorAreaFromWalls(walls);
  const displaySections = dedupeRoomSections(sections);
  const sectionCount = Math.max(1, displaySections.length);
  const enrichedSections = displaySections.map((section) => ({
    ...section,
    areaSqM:
      totalFootprint > 0 ? Number((totalFootprint / sectionCount).toFixed(1)) : section.areaSqM,
  }));

  return {
    version: 1,
    scannedAt: new Date().toISOString(),
    roomCount: sectionCount,
    totalAreaSqM: totalFootprint > 0 ? Number(totalFootprint.toFixed(1)) : null,
    sections: enrichedSections,
    walls,
    bounds: { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad },
  };
}

export function normalizeStoredScanMeta(raw: unknown): FloorPlanScanMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const meta = raw as Partial<FloorPlanScanMeta>;
  if (!meta.bounds || !Array.isArray(meta.sections)) return null;
  const walls = Array.isArray(meta.walls)
    ? dedupeWallSegments(meta.walls.map((w) => ({ ...w, lengthM: wallLengthMeters(w) })))
    : [];
  const sections = dedupeRoomSections(meta.sections);
  const totalFootprint = estimateFloorAreaFromWalls(walls);
  const sectionCount = Math.max(1, sections.length);
  const localizedSections = sections.map((section) => ({
    ...section,
    areaSqM:
      totalFootprint > 0 ? Number((totalFootprint / sectionCount).toFixed(1)) : section.areaSqM,
  }));
  return {
    version: 1,
    scannedAt: meta.scannedAt || new Date().toISOString(),
    roomCount: sectionCount,
    totalAreaSqM: totalFootprint > 0 ? Number(totalFootprint.toFixed(1)) : meta.totalAreaSqM ?? null,
    sections: localizedSections,
    walls,
    bounds: meta.bounds,
  };
}

export async function parseRoomPlanJsonFile(jsonUri: string): Promise<{
  walls: RoomScanWallSegment[];
  meta: FloorPlanScanMeta;
  raw: unknown;
}> {
  const { readAsStringAsync } = await import('expo-file-system/legacy');
  const text = await readAsStringAsync(jsonUri);
  const raw = JSON.parse(text) as unknown;
  const meta = buildFloorPlanScanMeta(raw);
  return {
    raw,
    walls: meta.walls,
    meta,
  };
}
