import type {
  FloorPlanScanMeta,
  RoomScanDetectedObject,
  RoomScanOpening,
  RoomScanOpeningKind,
  RoomScanSection,
  RoomScanWallSegment,
} from '../../types/roomScan';
import {
  deriveRoomDimensionsFromWalls,
  dedupeDetectedObjects,
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
import {
  listingRoomCountFromRooms,
  listingRoomCountFromSections,
  refineScanSections,
  totalUniqueAreaSqM,
  uniqueRoomsByFootprint,
} from './refineScanSections';

type SurfaceLike = {
  dimensions?: number[];
  transform?: number[];
  category?: Record<string, unknown>;
  identifier?: unknown;
  polygonCorners?: unknown;
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

type Point3 = { x: number; y: number; z: number };

function point3FromRaw(raw: unknown): Point3 | null {
  if (Array.isArray(raw) && raw.length >= 3) {
    const x = Number(raw[0]);
    const y = Number(raw[1]);
    const z = Number(raw[2]);
    return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? { x, y, z } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const x = Number(value.x ?? value['0']);
  const y = Number(value.y ?? value['1']);
  const z = Number(value.z ?? value['2']);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? { x, y, z } : null;
}

function polygonPointsFromSurface(surface: SurfaceLike): Point3[] {
  const raw = surface.polygonCorners;
  if (!Array.isArray(raw) || raw.length < 3) return [];
  if (typeof raw[0] === 'number') {
    const points: Point3[] = [];
    for (let index = 0; index + 2 < raw.length; index += 3) {
      const point = point3FromRaw([raw[index], raw[index + 1], raw[index + 2]]);
      if (point) points.push(point);
    }
    return points;
  }
  return raw.map(point3FromRaw).filter((point): point is Point3 => Boolean(point));
}

function polygonArea(points: { a: number; b: number }[]): number {
  if (points.length < 3) return 0;
  let twiceArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    twiceArea += current.a * next.b - next.a * current.b;
  }
  return Math.abs(twiceArea) / 2;
}

function floorSurfacePolygon(surface: SurfaceLike): { x: number; z: number }[] {
  const local = polygonPointsFromSurface(surface);
  if (local.length < 3) return [];
  const transform = surface.transform;
  const world =
    Array.isArray(transform) && transform.length >= 16
      ? local.map((point) => ({
          x: transform[0] * point.x + transform[4] * point.y + transform[8] * point.z + transform[12],
          y: transform[1] * point.x + transform[5] * point.y + transform[9] * point.z + transform[13],
          z: transform[2] * point.x + transform[6] * point.y + transform[10] * point.z + transform[14],
        }))
      : local;
  const worldXZ = world.map((point) => ({ x: point.x, z: point.z }));
  if (polygonArea(worldXZ.map((point) => ({ a: point.x, b: point.z }))) > 0.05) {
    return worldXZ;
  }

  const localPlanes = [
    local.map((point) => ({ x: point.x, z: point.y })),
    local.map((point) => ({ x: point.x, z: point.z })),
    local.map((point) => ({ x: point.y, z: point.z })),
  ];
  return localPlanes.reduce<{ x: number; z: number }[]>(
    (best, points) =>
      polygonArea(points.map((point) => ({ a: point.x, b: point.z }))) >
      polygonArea(best.map((point) => ({ a: point.x, b: point.z })))
        ? points
        : best,
    [],
  );
}

function floorSurfaceAreaSqM(surface: SurfaceLike): number {
  const polygon = floorSurfacePolygon(surface);
  const polygonSqM = polygonArea(polygon.map((point) => ({ a: point.x, b: point.z })));
  if (polygonSqM > 0.05) return polygonSqM;
  const dimensions = (surface.dimensions || [])
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0.05)
    .sort((a, b) => b - a);
  return dimensions.length >= 2 ? dimensions[0] * dimensions[1] : 0;
}

function largestFloorPolygon(surfaces: SurfaceLike[] | undefined): { x: number; z: number }[] | undefined {
  if (!Array.isArray(surfaces)) return undefined;
  const polygons = surfaces
    .map(floorSurfacePolygon)
    .filter((polygon) => polygon.length >= 3)
    .sort(
      (a, b) =>
        polygonArea(b.map((point) => ({ a: point.x, b: point.z }))) -
        polygonArea(a.map((point) => ({ a: point.x, b: point.z }))),
    );
  return polygons[0];
}

function floorSurfacesAreaSqM(surfaces: SurfaceLike[] | undefined): number {
  if (!Array.isArray(surfaces) || !surfaces.length) return 0;
  const seen = new Set<string>();
  return surfaces.reduce((sum, surface) => {
    const id = String(surface.identifier ?? '').trim();
    if (id && seen.has(id)) return sum;
    if (id) seen.add(id);
    const area = floorSurfaceAreaSqM(surface);
    return sum + (area > 0.2 && area < 2500 ? area : 0);
  }, 0);
}

function normalizeSectionAreasToFloor(
  sections: RoomScanSection[],
  floorAreaSqM: number,
): RoomScanSection[] {
  if (!sections.length || !(floorAreaSqM > 0)) return sections;
  const target = Number(floorAreaSqM.toFixed(1));
  const trusted = sections.filter(
    (section) => section.areaSource === 'floor' && typeof section.areaSqM === 'number' && section.areaSqM > 0,
  );
  const untrusted = sections.filter((section) => !trusted.includes(section));
  const trustedSum = trusted.reduce((sum, section) => sum + (section.areaSqM || 0), 0);
  const currentSum = sections.reduce((sum, section) => sum + (section.areaSqM || 0), 0);
  if (Math.abs(currentSum - target) <= 0.15) return sections;

  const distribute = (rows: RoomScanSection[], availableArea: number) => {
    const weights = rows.map((section) => {
      const direct = typeof section.areaSqM === 'number' && section.areaSqM > 0 ? section.areaSqM : 0;
      const dimensions =
        section.widthM && section.lengthM ? section.widthM * section.lengthM : 0;
      return direct || dimensions || 1;
    });
    const weightSum = weights.reduce((sum, value) => sum + value, 0) || rows.length;
    return rows.map((section, index) => ({
      ...section,
      areaSqM: Number(((availableArea * weights[index]) / weightSum).toFixed(1)),
    }));
  };

  if (trusted.length > 0 && untrusted.length > 0 && trustedSum < target) {
    const distributed = distribute(untrusted, target - trustedSum);
    let cursor = 0;
    return sections.map((section) =>
      section.areaSource === 'floor' ? section : distributed[cursor++],
    );
  }

  if (trusted.length > 0 && untrusted.length > 0 && trustedSum >= target - 0.15) {
    return sections.map((section) =>
      section.areaSource === 'floor' ? section : { ...section, areaSqM: undefined },
    );
  }

  return distribute(sections, target);
}

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
  const heightM = Number(obj.dimensions?.[1] || 0) || undefined;
  const depthM = Number(obj.dimensions?.[2] ?? obj.dimensions?.[1] ?? 0) || undefined;
  const dirX = Number(transform[0] || 0);
  const dirZ = Number(transform[2] || 0);
  const rotationDeg =
    Number.isFinite(dirX) && Number.isFinite(dirZ) && (Math.abs(dirX) > 0.001 || Math.abs(dirZ) > 0.001)
      ? Number(((Math.atan2(dirZ, dirX) * 180) / Math.PI).toFixed(1))
      : 0;
  return {
    id: `obj-${index}-${category}`,
    category,
    label: getRoomScanObjectLabel(category),
    centerX: transform[12],
    centerZ: transform[14],
    widthM,
    depthM,
    heightM: heightM && heightM > 0.15 && heightM < 3.5 ? heightM : undefined,
    rotationDeg,
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
  floorAreaSqM: number;
} {
  const root = payload as {
    walls?: SurfaceLike[];
    floors?: SurfaceLike[];
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

  const parsedRooms: {
    walls: RoomScanWallSegment[];
    sections: RoomScanSection[];
    floorAreaSqM: number;
    floorPolygon?: { x: number; z: number }[];
  }[] = [];
  const topLevelFloorAreaSqM = floorSurfacesAreaSqM(root.floors);
  let roomFloorAreaSqM = 0;

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

      const roomSections = Array.isArray(room.sections)
        ? room.sections.map(sectionFromRaw).filter((s): s is RoomScanSection => Boolean(s))
        : [];
      parsedRooms.push({
        walls: roomWalls,
        sections: roomSections,
        floorAreaSqM: floorSurfacesAreaSqM(room.floors),
        floorPolygon: largestFloorPolygon(room.floors),
      });
    }

    const uniqueRooms = uniqueRoomsByFootprint(parsedRooms);
    for (const room of uniqueRooms) {
      const roomWalls = room.walls;
      const roomFootprint = roomWalls.length ? estimateFloorAreaFromWalls(roomWalls) : 0;
      const measuredFloorArea = room.floorAreaSqM > 0 ? Number(room.floorAreaSqM.toFixed(1)) : 0;
      roomFloorAreaSqM += measuredFloorArea;
      const roomDimensions = deriveRoomDimensionsFromWalls(roomWalls);
      const roomCeiling = averageCeilingHeight(roomWalls);
      const roomSections = room.sections;
      const manySections = roomSections.length > 1 || uniqueRooms.length > 1;

      if (roomSections.length) {
        for (const section of roomSections) {
          const sectionFloorArea =
            roomSections.length === 1 && measuredFloorArea > 0 ? measuredFloorArea : undefined;
          sections.push({
            ...section,
            areaSqM:
              sectionFloorArea ??
              (manySections ? undefined : section.areaSqM ?? (roomFootprint || undefined)),
            areaSource: sectionFloorArea ? 'floor' : section.areaSource,
            floorPolygon: roomSections.length === 1 ? room.floorPolygon : section.floorPolygon,
            widthM: manySections ? undefined : section.widthM ?? roomDimensions?.widthM,
            lengthM: manySections ? undefined : section.lengthM ?? roomDimensions?.lengthM,
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
          areaSqM: measuredFloorArea || Number(roomFootprint.toFixed(1)),
          areaSource: measuredFloorArea ? 'floor' : undefined,
          floorPolygon: room.floorPolygon,
          widthM: roomDimensions?.widthM,
          lengthM: roomDimensions?.lengthM,
          ceilingHeightM: roomCeiling ?? undefined,
        });
      }
    }
  } else if (Array.isArray(root.sections)) {
    for (const section of root.sections) {
      const parsed = sectionFromRaw(section);
      if (parsed) {
        const singleFloorArea =
          root.sections.length === 1 && topLevelFloorAreaSqM > 0
            ? Number(topLevelFloorAreaSqM.toFixed(1))
            : undefined;
        sections.push({
          ...parsed,
          areaSqM: singleFloorArea,
          areaSource: singleFloorArea ? 'floor' : undefined,
          floorPolygon: root.sections.length === 1 ? largestFloorPolygon(root.floors) : undefined,
        });
      }
    }
  }

  return {
    walls: dedupeWallSegments(walls),
    objects,
    openings,
    sections: dedupeRoomSections(sections, 0.95),
    floorAreaSqM: Number((roomFloorAreaSqM || topLevelFloorAreaSqM).toFixed(1)),
  };
}

export function extractWallSegments(payload: unknown): RoomScanWallSegment[] {
  return collectSurfaces(payload).walls;
}

export function buildFloorPlanScanMeta(
  payload: unknown,
  compass?: {
    northRotationDegrees?: number | null;
    headingAccuracyDegrees?: number | null;
    headingSource?: 'true' | 'magnetic' | null;
  },
): FloorPlanScanMeta {
  const { walls, objects, openings, sections, floorAreaSqM } = collectSurfaces(payload);
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
  const overallDimensions = deriveRoomDimensionsFromWalls(walls);
  const enriched = enrichSectionsWithObjects(sections, objects, ceilingHeightM);
  let displaySections = refineScanSections(dedupeRoomSections(enriched), walls, objects, ceilingHeightM);
  if (!displaySections.length && walls.length) {
    const inferredKey = inferRoomTypeFromObjects(objects.map((item) => item.category));
    displaySections = [
      {
        key: inferredKey,
        label: getRoomScanSectionLabel(inferredKey),
        centerX: (minX + maxX) / 2,
        centerZ: (minZ + maxZ) / 2,
        areaSqM: totalFootprint > 0 ? Number(totalFootprint.toFixed(1)) : undefined,
        widthM: overallDimensions?.widthM,
        lengthM: overallDimensions?.lengthM,
        ceilingHeightM: ceilingHeightM ?? undefined,
        inferredFromObjects: inferredKey !== 'unspecified' ? true : undefined,
      },
    ];
  }
  const finalSections = normalizeSectionAreasToFloor(
    displaySections.map((section) => ({
      ...section,
      widthM: section.widthM ?? (displaySections.length === 1 ? overallDimensions?.widthM : undefined),
      lengthM: section.lengthM ?? (displaySections.length === 1 ? overallDimensions?.lengthM : undefined),
      ceilingHeightM: section.ceilingHeightM ?? ceilingHeightM ?? undefined,
    })),
    floorAreaSqM,
  );
  const measuredTotalArea =
    floorAreaSqM > 0 ? Number(floorAreaSqM.toFixed(1)) : totalUniqueAreaSqM(finalSections, walls);
  const listingCount = listingRoomCountFromSections(finalSections);

  return {
    version: 2,
    scannedAt: new Date().toISOString(),
    roomCount: listingCount || Math.max(1, finalSections.length),
    totalAreaSqM: measuredTotalArea > 0 ? measuredTotalArea : null,
    ceilingHeightM,
    sections: finalSections,
    walls,
    objects,
    openings,
    bounds: { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad },
    northRotationDegrees: compass?.northRotationDegrees ?? null,
    headingAccuracyDegrees: compass?.headingAccuracyDegrees ?? null,
    headingSource: compass?.headingSource ?? null,
  };
}

export function normalizeStoredScanMeta(raw: unknown): FloorPlanScanMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const meta = raw as Partial<FloorPlanScanMeta>;
  const storedRoomScans = Array.isArray(meta.roomScans) ? meta.roomScans : [];
  if ((!meta.bounds || !Array.isArray(meta.sections)) && storedRoomScans.length) {
    const roomAreaTotalSqM =
      typeof meta.roomAreaTotalSqM === 'number'
        ? meta.roomAreaTotalSqM
        : storedRoomScans.reduce((sum, room) => {
            const value = Number(String(room.areaM2 || '').replace(',', '.'));
            return sum + (Number.isFinite(value) ? value : 0);
          }, 0);
    return {
      version: 2,
      scannedAt: meta.scannedAt || new Date().toISOString(),
      roomCount: listingRoomCountFromRooms(storedRoomScans) || storedRoomScans.length,
      totalAreaSqM: roomAreaTotalSqM || null,
      ceilingHeightM: null,
      sections: [],
      walls: [],
      objects: [],
      openings: [],
      bounds: { minX: -2, maxX: 2, minZ: -2, maxZ: 2 },
      roomScans: storedRoomScans,
      roomAreaTotalSqM,
    };
  }
  if (!meta.bounds || !Array.isArray(meta.sections)) return null;
  const walls = Array.isArray(meta.walls)
    ? dedupeWallSegments(meta.walls.map((w) => ({ ...w, lengthM: wallLengthMeters(w) })))
    : [];
  const objects = dedupeDetectedObjects(Array.isArray(meta.objects) ? meta.objects : []);
  const openings = Array.isArray(meta.openings) ? meta.openings : [];
  const sections = dedupeRoomSections(meta.sections);
  const ceilingHeightM =
    typeof meta.ceilingHeightM === 'number'
      ? meta.ceilingHeightM
      : averageCeilingHeight(walls);
  const localizedSections = refineScanSections(
    enrichSectionsWithObjects(sections, objects, ceilingHeightM),
    walls,
    objects,
    ceilingHeightM,
  );
  const measuredTotalArea = totalUniqueAreaSqM(localizedSections, walls);
  return {
    version: 1,
    scannedAt: meta.scannedAt || new Date().toISOString(),
    roomCount:
      listingRoomCountFromSections(localizedSections) ||
      listingRoomCountFromRooms(storedRoomScans) ||
      Math.max(1, localizedSections.length),
    totalAreaSqM: measuredTotalArea > 0 ? measuredTotalArea : meta.totalAreaSqM ?? null,
    ceilingHeightM,
    sections: localizedSections,
    walls,
    objects,
    openings,
    bounds: meta.bounds,
    northRotationDegrees: meta.northRotationDegrees ?? null,
    headingAccuracyDegrees: meta.headingAccuracyDegrees ?? null,
    headingSource: meta.headingSource ?? null,
    roomScans: storedRoomScans.length ? storedRoomScans : undefined,
    roomAreaTotalSqM:
      typeof meta.roomAreaTotalSqM === 'number' ? meta.roomAreaTotalSqM : undefined,
  };
}

export async function parseRoomPlanJsonFile(
  jsonUri: string,
  compass?: {
    northRotationDegrees?: number | null;
    headingAccuracyDegrees?: number | null;
    headingSource?: 'true' | 'magnetic' | null;
  },
): Promise<{
  walls: RoomScanWallSegment[];
  meta: FloorPlanScanMeta;
  raw: unknown;
}> {
  const { readAsStringAsync } = await import('expo-file-system/legacy');
  const text = await readAsStringAsync(jsonUri);
  const raw = JSON.parse(text) as unknown;
  const meta = buildFloorPlanScanMeta(raw, compass);
  return {
    raw,
    walls: meta.walls,
    meta,
  };
}
