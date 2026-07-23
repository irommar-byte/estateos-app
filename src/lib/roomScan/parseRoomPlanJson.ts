import type {
  FloorPlanScanMeta,
  RoomScanDetectedObject,
  RoomScanObjectCategory,
  RoomScanOpening,
  RoomScanOpeningKind,
  RoomScanSection,
  RoomScanWallSegment,
} from '../../types/roomScan';
import {
  dedupeRoomSections,
  dedupeWallSegments,
  estimateFloorAreaFromWalls,
  wallLengthMeters,
} from './floorPlanGeometry';
import {
  getRoomScanObjectLabel,
  getRoomScanSectionLabel,
  inferRoomTypeFromObjects,
  normalizeRoomScanObjectCategory,
} from './roomScanLabels';

type SurfaceLike = {
  dimensions?: number[];
  transform?: number[];
  category?: Record<string, unknown>;
};

type ObjectLike = {
  dimensions?: number[];
  transform?: number[];
  category?: Record<string, unknown> | string;
};

type SectionLike = {
  label?: unknown;
  center?: number[];
  story?: number;
};

type RoomLike = {
  walls?: SurfaceLike[];
  floors?: SurfaceLike[];
  ceilings?: SurfaceLike[];
  doors?: SurfaceLike[];
  windows?: SurfaceLike[];
  openings?: SurfaceLike[];
  objects?: ObjectLike[];
  sections?: SectionLike[];
};

function categoryKey(raw: unknown): string {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (!raw || typeof raw !== 'object') return 'unknown';
  return Object.keys(raw as Record<string, unknown>)[0] || 'unknown';
}

function wallSegmentFromSurface(surface: SurfaceLike): RoomScanWallSegment | null {
  const width = Number(surface.dimensions?.[0] || 0);
  const height = Number(surface.dimensions?.[1] || 0);
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
    heightM: height > 0.5 && height < 6 ? height : undefined,
  };
}

function openingFromSurface(surface: SurfaceLike, kind: RoomScanOpeningKind, index: number): RoomScanOpening | null {
  const segment = wallSegmentFromSurface(surface);
  if (!segment) return null;
  return {
    id: `${kind}-${index}`,
    kind,
    x1: segment.x1,
    z1: segment.z1,
    x2: segment.x2,
    z2: segment.z2,
    lengthM: segment.lengthM,
  };
}

function objectFromRaw(obj: ObjectLike, index: number): RoomScanDetectedObject | null {
  const transform = obj.transform;
  if (!transform || transform.length < 16) return null;
  const category = normalizeRoomScanObjectCategory(categoryKey(obj.category));
  const widthM = Number(obj.dimensions?.[0] || 0) || undefined;
  const depthM = Number(obj.dimensions?.[2] ?? obj.dimensions?.[1] ?? 0) || undefined;
  return {
    id: `obj-${index}-${category}`,
    category,
    label: getRoomScanObjectLabel(category),
    centerX: transform[12],
    centerZ: transform[14],
    widthM,
    depthM,
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

function averageCeilingHeight(walls: RoomScanWallSegment[]): number | null {
  const heights = walls
    .map((w) => w.heightM)
    .filter((h): h is number => typeof h === 'number' && h > 1.8 && h < 5.5);
  if (!heights.length) return null;
  const avg = heights.reduce((s, h) => s + h, 0) / heights.length;
  return Number(avg.toFixed(2));
}

function objectsNearPoint(
  objects: RoomScanDetectedObject[],
  x: number,
  z: number,
  radiusM: number,
): RoomScanDetectedObject[] {
  return objects.filter((obj) => Math.hypot(obj.centerX - x, obj.centerZ - z) <= radiusM);
}

function enrichSectionsWithObjects(
  sections: RoomScanSection[],
  objects: RoomScanDetectedObject[],
  defaultCeiling: number | null,
): RoomScanSection[] {
  return sections.map((section) => {
    const nearby = objectsNearPoint(objects, section.centerX, section.centerZ, 3.2);
    const inferredKey =
      section.key === 'unspecified' || !section.key
        ? inferRoomTypeFromObjects(nearby.map((o) => o.category))
        : section.key;
    const inferred = inferredKey !== section.key && section.key === 'unspecified';
    return {
      ...section,
      key: inferredKey,
      label: getRoomScanSectionLabel(inferredKey),
      ceilingHeightM: section.ceilingHeightM ?? defaultCeiling ?? undefined,
      inferredFromObjects: inferred || undefined,
    };
  });
}

function collectSurfaces(payload: unknown): {
  walls: RoomScanWallSegment[];
  objects: RoomScanDetectedObject[];
  openings: RoomScanOpening[];
  sections: RoomScanSection[];
} {
  const root = payload as {
    walls?: SurfaceLike[];
    doors?: SurfaceLike[];
    windows?: SurfaceLike[];
    openings?: SurfaceLike[];
    objects?: ObjectLike[];
    sections?: SectionLike[];
    rooms?: RoomLike[];
  };

  const walls: RoomScanWallSegment[] = [];
  const objects: RoomScanDetectedObject[] = [];
  const openings: RoomScanOpening[] = [];
  const sections: RoomScanSection[] = [];
  const seenRoomPrints = new Set<string>();
  let objectIndex = 0;
  let openingIndex = 0;

  const pushOpenings = (list: SurfaceLike[] | undefined, kind: RoomScanOpeningKind) => {
    if (!Array.isArray(list)) return;
    for (const surface of list) {
      const opening = openingFromSurface(surface, kind, openingIndex++);
      if (opening) openings.push(opening);
    }
  };

  const pushObjects = (list: ObjectLike[] | undefined) => {
    if (!Array.isArray(list)) return;
    for (const obj of list) {
      const parsed = objectFromRaw(obj, objectIndex++);
      if (parsed) objects.push(parsed);
    }
  };

  if (Array.isArray(root.walls)) {
    for (const surface of root.walls) {
      const wall = wallSegmentFromSurface(surface);
      if (wall) walls.push(wall);
    }
  }
  pushOpenings(root.doors, 'door');
  pushOpenings(root.windows, 'window');
  pushOpenings(root.openings, 'opening');
  pushObjects(root.objects);

  if (Array.isArray(root.rooms) && root.rooms.length > 0) {
    for (const room of root.rooms) {
      const roomWalls = Array.isArray(room.walls)
        ? dedupeWallSegments(
            room.walls.map(wallSegmentFromSurface).filter((s): s is RoomScanWallSegment => Boolean(s)),
          )
        : [];
      walls.push(...roomWalls);
      pushOpenings(room.doors, 'door');
      pushOpenings(room.windows, 'window');
      pushOpenings(room.openings, 'opening');
      pushObjects(room.objects);

      if (roomWalls.length) {
        const fingerprint = roomWallsFingerprint(roomWalls);
        if (seenRoomPrints.has(fingerprint)) continue;
        seenRoomPrints.add(fingerprint);
      }

      const roomFootprint = roomWalls.length ? estimateFloorAreaFromWalls(roomWalls) : 0;
      const roomCeiling = averageCeilingHeight(roomWalls);
      const roomSections = Array.isArray(room.sections)
        ? room.sections.map(sectionFromRaw).filter((s): s is RoomScanSection => Boolean(s))
        : [];

      if (roomSections.length) {
        const perSectionArea =
          roomFootprint > 0 ? Number((roomFootprint / roomSections.length).toFixed(1)) : undefined;
        for (const section of roomSections) {
          sections.push({
            ...section,
            areaSqM: section.areaSqM ?? perSectionArea,
            ceilingHeightM: roomCeiling ?? undefined,
          });
        }
        continue;
      }

      if (roomWalls.length) {
        const xs = roomWalls.flatMap((w) => [w.x1, w.x2]);
        const zs = roomWalls.flatMap((w) => [w.z1, w.z2]);
        sections.push({
          key: 'unspecified',
          label: getRoomScanSectionLabel('unspecified'),
          centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
          centerZ: (Math.min(...zs) + Math.max(...zs)) / 2,
          areaSqM: Number(roomFootprint.toFixed(1)),
          ceilingHeightM: roomCeiling ?? undefined,
        });
      }
    }
  } else if (Array.isArray(root.sections)) {
    for (const section of root.sections) {
      const parsed = sectionFromRaw(section);
      if (parsed) sections.push(parsed);
    }
  }

  return {
    walls: dedupeWallSegments(walls),
    objects,
    openings,
    sections: dedupeRoomSections(sections, 0.95),
  };
}

export function extractWallSegments(payload: unknown): RoomScanWallSegment[] {
  return collectSurfaces(payload).walls;
}

export function buildFloorPlanScanMeta(payload: unknown): FloorPlanScanMeta {
  const { walls, objects, openings, sections } = collectSurfaces(payload);
  const ceilingHeightM = averageCeilingHeight(walls);

  const xs = walls.flatMap((w) => [w.x1, w.x2]);
  const zs = walls.flatMap((w) => [w.z1, w.z2]);
  const objectXs = objects.map((o) => o.centerX);
  const objectZs = objects.map((o) => o.centerZ);
  const sectionXs = sections.map((s) => s.centerX);
  const sectionZs = sections.map((s) => s.centerZ);

  const allX = [...xs, ...objectXs, ...sectionXs];
  const allZ = [...zs, ...objectZs, ...sectionZs];

  const minX = allX.length ? Math.min(...allX) : -2;
  const maxX = allX.length ? Math.max(...allX) : 2;
  const minZ = allZ.length ? Math.min(...allZ) : -2;
  const maxZ = allZ.length ? Math.max(...allZ) : 2;

  const pad = 0.85;
  const totalFootprint = estimateFloorAreaFromWalls(walls);
  const enriched = enrichSectionsWithObjects(sections, objects, ceilingHeightM);
  const displaySections = dedupeRoomSections(enriched);
  const sectionCount = Math.max(1, displaySections.length);
  const finalSections = displaySections.map((section) => ({
    ...section,
    areaSqM:
      totalFootprint > 0 ? Number((totalFootprint / sectionCount).toFixed(1)) : section.areaSqM,
    ceilingHeightM: section.ceilingHeightM ?? ceilingHeightM ?? undefined,
  }));

  return {
    version: 1,
    scannedAt: new Date().toISOString(),
    roomCount: sectionCount,
    totalAreaSqM: totalFootprint > 0 ? Number(totalFootprint.toFixed(1)) : null,
    ceilingHeightM,
    sections: finalSections,
    walls,
    objects,
    openings,
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
  const objects = Array.isArray(meta.objects) ? meta.objects : [];
  const openings = Array.isArray(meta.openings) ? meta.openings : [];
  const sections = dedupeRoomSections(meta.sections);
  const totalFootprint = estimateFloorAreaFromWalls(walls);
  const ceilingHeightM =
    typeof meta.ceilingHeightM === 'number'
      ? meta.ceilingHeightM
      : averageCeilingHeight(walls);
  const sectionCount = Math.max(1, sections.length);
  const localizedSections = enrichSectionsWithObjects(sections, objects, ceilingHeightM).map(
    (section) => ({
      ...section,
      areaSqM:
        totalFootprint > 0 ? Number((totalFootprint / sectionCount).toFixed(1)) : section.areaSqM,
    }),
  );
  return {
    version: 1,
    scannedAt: meta.scannedAt || new Date().toISOString(),
    roomCount: sectionCount,
    totalAreaSqM: totalFootprint > 0 ? Number(totalFootprint.toFixed(1)) : meta.totalAreaSqM ?? null,
    ceilingHeightM,
    sections: localizedSections,
    walls,
    objects,
    openings,
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
