import type {
  FloorPlanScanMeta,
  PropertyRoomScan,
  RoomScanDetectedObject,
  RoomScanSection,
  RoomScanWallSegment,
} from '../../types/roomScan';
import { deriveRoomDimensionsFromWalls, estimateFloorAreaFromWalls } from './roomScanMeasurements';
import { inferRoomTypeFromObjects } from './roomScanClassify';

export const LISTING_ROOM_TYPE_KEYS = new Set([
  'livingRoom',
  'livingRoomKitchenette',
  'bedroom',
  'room',
  'office',
  'diningRoom',
]);

export const ROOM_PRESET_DEFS: Array<{ key: string; label: string }> = [
  { key: 'livingRoom', label: 'Salon' },
  { key: 'livingRoomKitchenette', label: 'Salon z aneksem kuchennym' },
  { key: 'room', label: 'Pokój' },
  { key: 'bedroom', label: 'Sypialnia' },
  { key: 'kitchen', label: 'Kuchnia' },
  { key: 'diningRoom', label: 'Jadalnia' },
  { key: 'bathroom', label: 'Łazienka' },
  { key: 'wc', label: 'WC' },
  { key: 'hallway', label: 'Przedpokój' },
  { key: 'office', label: 'Gabinet' },
  { key: 'closet', label: 'Garderoba' },
  { key: 'storageUnit', label: 'Komórka lokatorska' },
  { key: 'balcony', label: 'Balkon / Taras' },
  { key: 'garage', label: 'Garaż' },
  { key: 'laundry', label: 'Pralnia' },
  { key: 'unspecified', label: 'Inne' },
];

const NAME_TO_KEY: Record<string, string> = Object.fromEntries(
  ROOM_PRESET_DEFS.flatMap((row) => [
    [row.label.toLowerCase(), row.key],
    [row.key.toLowerCase(), row.key],
  ]).concat([
    ['korytarz', 'hallway'],
    ['przedpokój', 'hallway'],
    ['komórka', 'storageUnit'],
    ['toaleta', 'wc'],
    ['aneeks', 'livingRoomKitchenette'],
    ['aneks', 'livingRoomKitchenette'],
  ]),
);

export function roomTypeKeyFromName(name: string): string {
  const raw = String(name || '').trim().toLowerCase();
  if (!raw) return 'unspecified';
  if (NAME_TO_KEY[raw]) return NAME_TO_KEY[raw];
  const hit = Object.entries(NAME_TO_KEY).find(([label]) => raw.includes(label));
  return hit?.[1] || 'unspecified';
}

export function roomTypeLabelFromKey(key: string, fallback = ''): string {
  return ROOM_PRESET_DEFS.find((row) => row.key === key)?.label || fallback;
}

export function applyRoomIdentityToScanMeta(
  meta: FloorPlanScanMeta | undefined,
  params: { sectionIndex?: number | null; name: string; typeKey?: string },
): FloorPlanScanMeta | undefined {
  if (!meta?.sections?.length) return meta;
  const key = params.typeKey || roomTypeKeyFromName(params.name);
  const label = String(params.name || '').trim() || roomTypeLabelFromKey(key, 'Pomieszczenie');
  let idx = params.sectionIndex;
  if (idx == null || idx < 0 || idx >= meta.sections.length) {
    idx = meta.sections.length === 1 ? 0 : null;
  }
  if (idx == null) return meta;
  const sections = meta.sections.map((section, i) =>
    i === idx ? { ...section, key, label, userAssigned: true } : section,
  );
  return { ...meta, sections };
}

export function listingRoomCountFromKeys(keys: Array<string | undefined>): number {
  return keys.filter((key) => LISTING_ROOM_TYPE_KEYS.has(String(key || ''))).length;
}

export function listingRoomCountFromRooms(rooms: Array<{ name?: string; typeKey?: string }>): number {
  return listingRoomCountFromKeys(rooms.map((room) => room.typeKey || roomTypeKeyFromName(room.name || '')));
}

export function livableAreaFromRooms(rooms: Array<{ name?: string; typeKey?: string; areaM2?: string }>): number {
  return rooms.reduce((sum, room) => {
    const key = room.typeKey || roomTypeKeyFromName(room.name || '');
    if (key === 'balcony' || key === 'garage') return sum;
    const value = Number(String(room.areaM2 || '').replace(',', '.'));
    return sum + (Number.isFinite(value) && value > 0 ? value : 0);
  }, 0);
}

type BBox = { minX: number; maxX: number; minZ: number; maxZ: number };

export function wallsBoundingBox(walls: RoomScanWallSegment[]): BBox | null {
  if (!walls.length) return null;
  const xs = walls.flatMap((w) => [w.x1, w.x2]);
  const zs = walls.flatMap((w) => [w.z1, w.z2]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

export function bboxIou(a: BBox, b: BBox): number {
  const ix = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const iz = Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ));
  const inter = ix * iz;
  const areaA = Math.max(0, a.maxX - a.minX) * Math.max(0, a.maxZ - a.minZ);
  const areaB = Math.max(0, b.maxX - b.minX) * Math.max(0, b.maxZ - b.minZ);
  const union = areaA + areaB - inter;
  return union <= 0 ? 0 : inter / union;
}

function objectsNear(
  objects: RoomScanDetectedObject[],
  x: number,
  z: number,
  radiusM: number,
): RoomScanDetectedObject[] {
  return objects.filter((obj) => Math.hypot(obj.centerX - x, obj.centerZ - z) <= radiusM);
}

function wallMid(wall: RoomScanWallSegment) {
  return { x: (wall.x1 + wall.x2) / 2, z: (wall.z1 + wall.z2) / 2 };
}

function assignWallsToSection(
  section: RoomScanSection,
  allSections: RoomScanSection[],
  walls: RoomScanWallSegment[],
): RoomScanWallSegment[] {
  const assigned = walls.filter((wall) => {
    const mid = wallMid(wall);
    let best = section;
    let bestDist = Math.hypot(mid.x - section.centerX, mid.z - section.centerZ);
    for (const other of allSections) {
      if (other === section) continue;
      const dist = Math.hypot(mid.x - other.centerX, mid.z - other.centerZ);
      if (dist < bestDist) {
        best = other;
        bestDist = dist;
      }
    }
    return best === section;
  });
  if (assigned.length >= 2) return assigned;
  const radius = 2.6;
  return walls.filter((wall) => {
    const mid = wallMid(wall);
    return Math.hypot(mid.x - section.centerX, mid.z - section.centerZ) <= radius;
  });
}

function contradictsAppleLabel(
  appleKey: string,
  inferred: string,
  nearby: RoomScanDetectedObject[],
): boolean {
  const cats = new Set(nearby.map((o) => o.category));
  if (appleKey === 'bathroom' || appleKey === 'wc') {
    if (cats.has('bed') && !cats.has('toilet') && !cats.has('bathtub')) return true;
    if (inferred === 'bedroom' || inferred === 'livingRoom' || inferred === 'livingRoomKitchenette') return true;
  }
  if (appleKey === 'kitchen' && cats.has('bed') && !cats.has('stove') && !cats.has('oven')) return true;
  return false;
}

function resolveSectionKey(
  appleKey: string,
  nearby: RoomScanDetectedObject[],
  areaSqM?: number,
  widthM?: number,
  lengthM?: number,
): string {
  const inferred = inferRoomTypeFromObjects(
    nearby.map((o) => o.category),
    { areaSqM, widthM, lengthM },
  );
  const key = appleKey && appleKey !== 'unspecified' ? appleKey : inferred;
  if (contradictsAppleLabel(key, inferred, nearby)) return inferred;
  if (inferred === 'livingRoomKitchenette') return inferred;
  return key === 'unspecified' ? inferred : key;
}

function maybeAddHallway(
  sections: RoomScanSection[],
  walls: RoomScanWallSegment[],
  objects: RoomScanDetectedObject[],
  ceilingHeightM: number | null,
): RoomScanSection[] {
  if (sections.some((s) => s.key === 'hallway')) return sections;
  if (sections.length < 2 || walls.length < 4) return sections;

  const orphan = walls.filter((wall) => {
    const mid = wallMid(wall);
    const nearest = Math.min(
      ...sections.map((s) => Math.hypot(mid.x - s.centerX, mid.z - s.centerZ)),
    );
    return nearest > 1.7;
  });
  if (orphan.length < 3) return sections;

  const xs = orphan.flatMap((w) => [w.x1, w.x2]);
  const zs = orphan.flatMap((w) => [w.z1, w.z2]);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerZ = (Math.min(...zs) + Math.max(...zs)) / 2;
  if (sections.some((s) => Math.hypot(s.centerX - centerX, s.centerZ - centerZ) < 1.1)) {
    return sections;
  }

  const nearby = objectsNear(objects, centerX, centerZ, 1.8);
  const dims = deriveRoomDimensionsFromWalls(orphan);
  const area = estimateFloorAreaFromWalls(orphan);
  if (area < 2.2) return sections;

  return [
    ...sections,
    {
      key: 'hallway',
      label: ROOM_PRESET_DEFS.find((row) => row.key === 'hallway')?.label || 'Przedpokój',
      centerX,
      centerZ,
      areaSqM: Number(area.toFixed(1)),
      widthM: dims?.widthM,
      lengthM: dims?.lengthM,
      ceilingHeightM: ceilingHeightM ?? undefined,
      inferredFromObjects: nearby.length === 0 ? true : undefined,
    },
  ];
}

export function refineScanSections(
  sections: RoomScanSection[],
  walls: RoomScanWallSegment[],
  objects: RoomScanDetectedObject[],
  ceilingHeightM: number | null,
): RoomScanSection[] {
  if (!sections.length) return sections;
  const globalFootprint = estimateFloorAreaFromWalls(walls);
  const globalDims = deriveRoomDimensionsFromWalls(walls);

  let next: RoomScanSection[] = sections.map((section) => {
    if (section.userAssigned) return section;
    const nearby = objectsNear(objects, section.centerX, section.centerZ, 2.45);
    const key = resolveSectionKey(
      section.key,
      nearby,
      section.areaSqM,
      section.widthM,
      section.lengthM,
    );
    return {
      ...section,
      key,
      label: ROOM_PRESET_DEFS.find((row) => row.key === key)?.label || section.label,
      inferredFromObjects: key !== section.key ? true : section.inferredFromObjects || undefined,
    };
  });

  // Przy powierzchniach podłóg RoomPlan zwraca już rzeczywiste sekcje.
  // Nie dokładamy wtedy sztucznego korytarza z osieroconych fragmentów ścian.
  if (!next.some((section) => section.areaSource === 'floor')) {
    next = maybeAddHallway(next, walls, objects, ceilingHeightM);
  }

  next = next.map((section) => {
    const localWalls = assignWallsToSection(section, next, walls);
    const dims = deriveRoomDimensionsFromWalls(localWalls.length >= 2 ? localWalls : walls);
    const floorArea =
      section.areaSource === 'floor' &&
      typeof section.areaSqM === 'number' &&
      section.areaSqM > 0
        ? section.areaSqM
        : null;
    let area = localWalls.length >= 2 ? estimateFloorAreaFromWalls(localWalls) : 0;
    if (
      next.length > 1 &&
      globalFootprint > 0 &&
      area > 0 &&
      area >= globalFootprint * 0.82
    ) {
      area = 0;
    }
    if (!area && dims) area = dims.widthM * dims.lengthM;
    if (
      next.length > 1 &&
      globalDims &&
      dims &&
      Math.abs(dims.widthM - globalDims.widthM) < 0.12 &&
      Math.abs(dims.lengthM - globalDims.lengthM) < 0.12
    ) {
      const nearby = objectsNear(objects, section.centerX, section.centerZ, 2.1);
      const objBox = objectClusterBox(nearby);
      if (objBox) {
        const w = objBox.widthM;
        const l = objBox.lengthM;
        return {
          ...section,
          widthM: w,
          lengthM: l,
          areaSqM: floorArea ?? Number((w * l).toFixed(1)),
          ceilingHeightM: section.ceilingHeightM ?? ceilingHeightM ?? undefined,
        };
      }
    }
    return {
      ...section,
      widthM: dims?.widthM ?? section.widthM,
      lengthM: dims?.lengthM ?? section.lengthM,
      areaSqM: floorArea ?? (area > 0 ? Number(area.toFixed(1)) : section.areaSqM),
      ceilingHeightM: section.ceilingHeightM ?? ceilingHeightM ?? undefined,
    };
  });

  const sum = next.reduce((acc, s) => acc + (s.areaSqM || 0), 0);
  const hasMeasuredFloorArea = next.some((section) => section.areaSource === 'floor');
  if (!hasMeasuredFloorArea && next.length > 1 && globalFootprint > 1 && sum > globalFootprint * 1.08) {
    const scale = globalFootprint / sum;
    next = next.map((section) => ({
      ...section,
      areaSqM:
        typeof section.areaSqM === 'number'
          ? Number((section.areaSqM * scale).toFixed(1))
          : section.areaSqM,
    }));
  }

  return next;
}

function objectClusterBox(objects: RoomScanDetectedObject[]): { widthM: number; lengthM: number } | null {
  if (objects.length < 1) return null;
  const xs = objects.flatMap((o) => [o.centerX - (o.widthM || 0.4) / 2, o.centerX + (o.widthM || 0.4) / 2]);
  const zs = objects.flatMap((o) => [o.centerZ - (o.depthM || 0.4) / 2, o.centerZ + (o.depthM || 0.4) / 2]);
  const widthM = Math.max(1.4, Math.max(...xs) - Math.min(...xs) + 0.6);
  const lengthM = Math.max(1.6, Math.max(...zs) - Math.min(...zs) + 0.6);
  if (widthM > 12 || lengthM > 12) return null;
  return {
    widthM: Number(Math.min(widthM, lengthM).toFixed(2)),
    lengthM: Number(Math.max(widthM, lengthM).toFixed(2)),
  };
}

export function uniqueRoomsByFootprint<T extends { walls: RoomScanWallSegment[]; sections: RoomScanSection[] }>(
  rooms: T[],
): T[] {
  const unique: T[] = [];
  for (const room of rooms) {
    const bbox = wallsBoundingBox(room.walls);
    if (!bbox) {
      unique.push(room);
      continue;
    }
    const dup = unique.find((existing) => {
      const other = wallsBoundingBox(existing.walls);
      return other ? bboxIou(bbox, other) > 0.78 : false;
    });
    if (!dup) {
      unique.push(room);
      continue;
    }
    for (const section of room.sections) {
      const near = dup.sections.some(
        (existing) => Math.hypot(existing.centerX - section.centerX, existing.centerZ - section.centerZ) < 0.95,
      );
      if (!near) dup.sections.push(section);
    }
  }
  return unique;
}

export function listingRoomCountFromSections(sections: RoomScanSection[]): number {
  return listingRoomCountFromKeys(sections.map((s) => s.key));
}

export function totalUniqueAreaSqM(sections: RoomScanSection[], walls: RoomScanWallSegment[]): number {
  const measuredFloors = sections.filter(
    (section) =>
      section.areaSource === 'floor' &&
      typeof section.areaSqM === 'number' &&
      section.areaSqM > 0,
  );
  if (measuredFloors.length === sections.length && measuredFloors.length > 0) {
    return Number(
      measuredFloors.reduce((sum, section) => sum + (section.areaSqM || 0), 0).toFixed(1),
    );
  }
  const footprint = estimateFloorAreaFromWalls(walls);
  const sum = sections.reduce((acc, s) => acc + (typeof s.areaSqM === 'number' ? s.areaSqM : 0), 0);
  if (footprint > 0 && sections.length > 1) {
    if (sum <= 0) return Number(footprint.toFixed(1));
    return Number(Math.min(sum, footprint * 1.04).toFixed(1));
  }
  return Number((sum || footprint).toFixed(1));
}

export function resolveRoomSectionIndex(
  meta: FloorPlanScanMeta,
  room: Pick<PropertyRoomScan, 'sourceSectionIndex' | 'name' | 'typeKey'>,
): number | null {
  const sections = meta.sections || [];
  if (typeof room.sourceSectionIndex === 'number' && sections[room.sourceSectionIndex]) {
    return room.sourceSectionIndex;
  }
  const byLabel = sections.findIndex((section) => section.label === room.name);
  if (byLabel >= 0) return byLabel;
  const key = room.typeKey || roomTypeKeyFromName(room.name || '');
  const byKey = sections.findIndex((section) => section.key === key);
  return byKey >= 0 ? byKey : null;
}

function wallsFromPolygon(
  polygon: { x: number; z: number }[],
  sourceWalls: RoomScanWallSegment[],
): RoomScanWallSegment[] {
  const points = polygon.filter(
    (point, index) =>
      index === 0 ||
      Math.hypot(point.x - polygon[index - 1].x, point.z - polygon[index - 1].z) > 0.04,
  );
  if (
    points.length > 2 &&
    Math.hypot(
      points[0].x - points[points.length - 1].x,
      points[0].z - points[points.length - 1].z,
    ) < 0.04
  ) {
    points.pop();
  }
  const heights = sourceWalls
    .map((wall) => wall.heightM)
    .filter((height): height is number => typeof height === 'number' && height > 1);
  const heightM = heights.length
    ? heights.reduce((sum, height) => sum + height, 0) / heights.length
    : undefined;
  return points
    .map((point, index) => {
      const next = points[(index + 1) % points.length];
      const lengthM = Math.hypot(next.x - point.x, next.z - point.z);
      return {
        x1: point.x,
        z1: point.z,
        x2: next.x,
        z2: next.z,
        lengthM,
        heightM,
      };
    })
    .filter((wall) => (wall.lengthM || 0) > 0.12);
}

function rectangularRoomPerimeter(
  section: RoomScanSection,
  sourceWalls: RoomScanWallSegment[],
): { walls: RoomScanWallSegment[]; polygon: { x: number; z: number }[] } | null {
  const width = Number(section.widthM || 0);
  const length = Number(section.lengthM || 0);
  const structural = sourceWalls
    .filter((wall) => Math.hypot(wall.x2 - wall.x1, wall.z2 - wall.z1) > 0.45)
    .sort(
      (a, b) =>
        Math.hypot(b.x2 - b.x1, b.z2 - b.z1) -
        Math.hypot(a.x2 - a.x1, a.z2 - a.z1),
    );
  if (!(width > 0.4) || !(length > 0.4) || width > 30 || length > 30 || structural.length < 2) {
    return null;
  }

  const dominant = structural[0];
  const dominantLength = Math.hypot(dominant.x2 - dominant.x1, dominant.z2 - dominant.z1);
  const ux = (dominant.x2 - dominant.x1) / dominantLength;
  const uz = (dominant.z2 - dominant.z1) / dominantLength;
  const vx = -uz;
  const vz = ux;
  const hasDiagonal = structural.some((wall) => {
    const dx = wall.x2 - wall.x1;
    const dz = wall.z2 - wall.z1;
    const magnitude = Math.hypot(dx, dz) || 1;
    const along = Math.abs((dx * ux + dz * uz) / magnitude);
    const across = Math.abs((dx * vx + dz * vz) / magnitude);
    return Math.max(along, across) < 0.94;
  });
  if (hasDiagonal) return null;

  const alongM = Math.abs(length - dominantLength) <= Math.abs(width - dominantLength) ? length : width;
  const acrossM = alongM === length ? width : length;
  const hu = alongM / 2;
  const hv = acrossM / 2;
  const polygon = [
    { x: section.centerX - ux * hu - vx * hv, z: section.centerZ - uz * hu - vz * hv },
    { x: section.centerX + ux * hu - vx * hv, z: section.centerZ + uz * hu - vz * hv },
    { x: section.centerX + ux * hu + vx * hv, z: section.centerZ + uz * hu + vz * hv },
    { x: section.centerX - ux * hu + vx * hv, z: section.centerZ - uz * hu + vz * hv },
  ];
  return { walls: wallsFromPolygon(polygon, sourceWalls), polygon };
}

function distanceToWall(x: number, z: number, wall: RoomScanWallSegment): number {
  const dx = wall.x2 - wall.x1;
  const dz = wall.z2 - wall.z1;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq <= 0.0001) return Math.hypot(x - wall.x1, z - wall.z1);
  const t = Math.max(0, Math.min(1, ((x - wall.x1) * dx + (z - wall.z1) * dz) / lengthSq));
  return Math.hypot(x - (wall.x1 + dx * t), z - (wall.z1 + dz * t));
}

function pointInPolygon(x: number, z: number, polygon: { x: number; z: number }[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index];
    const b = polygon[previous];
    if (
      (a.z > z) !== (b.z > z) &&
      x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z || 0.00001) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function cropScanMetaToRoom(
  meta: FloorPlanScanMeta | null | undefined,
  room: PropertyRoomScan,
): FloorPlanScanMeta | null {
  if (room.scanMeta?.walls?.length) return room.scanMeta;
  if (!meta?.walls?.length) return null;
  const index = resolveRoomSectionIndex(meta, room);
  if (index == null) return null;
  const section = meta.sections[index];
  const assignedWalls = assignWallsToSection(section, meta.sections, meta.walls);
  const floorPolygon = section.floorPolygon?.length && section.floorPolygon.length >= 3
    ? section.floorPolygon
    : null;
  const exactPerimeter = floorPolygon
    ? { walls: wallsFromPolygon(floorPolygon, assignedWalls), polygon: floorPolygon }
    : null;
  const perimeter = exactPerimeter || rectangularRoomPerimeter(section, assignedWalls);
  const walls = perimeter?.walls?.length ? perimeter.walls : assignedWalls;
  const polygon = perimeter?.polygon;
  const objects = polygon
    ? (meta.objects || []).filter(
        (object) =>
          pointInPolygon(object.centerX, object.centerZ, polygon) ||
          walls.some((wall) => distanceToWall(object.centerX, object.centerZ, wall) <= 0.28),
      )
    : objectsNear(meta.objects || [], section.centerX, section.centerZ, 2.4);
  const box = wallsBoundingBox(walls);
  const pad = 0.4;
  const bounds = box
    ? { minX: box.minX - pad, maxX: box.maxX + pad, minZ: box.minZ - pad, maxZ: box.maxZ + pad }
    : {
        minX: section.centerX - 2.2,
        maxX: section.centerX + 2.2,
        minZ: section.centerZ - 2.2,
        maxZ: section.centerZ + 2.2,
      };
  const openings = (meta.openings || []).filter((opening) => {
    const mx = (opening.x1 + opening.x2) / 2;
    const mz = (opening.z1 + opening.z2) / 2;
    const insideBounds =
      mx >= bounds.minX && mx <= bounds.maxX && mz >= bounds.minZ && mz <= bounds.maxZ;
    return insideBounds && (!polygon || walls.some((wall) => distanceToWall(mx, mz, wall) <= 0.45));
  });
  return {
    ...meta,
    roomCount: 1,
    totalAreaSqM: section.areaSqM ?? null,
    ceilingHeightM: section.ceilingHeightM ?? meta.ceilingHeightM,
    sections: [section],
    walls: walls.length ? walls : meta.walls,
    objects,
    openings,
    bounds,
    roomScans: undefined,
  };
}

export function roomsFromScanMeta(meta: FloorPlanScanMeta | null | undefined): PropertyRoomScan[] {
  if (!meta) return [];
  const fromSections: PropertyRoomScan[] = (meta.sections || []).map((section, index) => ({
    id: `section-${index}`,
    name: section.label || roomTypeLabelFromKey(section.key, `Pomieszczenie ${index + 1}`),
    typeKey: section.key,
    sourceSectionIndex: index,
    widthM: section.widthM && section.widthM > 0 ? String(section.widthM) : '',
    lengthM: section.lengthM && section.lengthM > 0 ? String(section.lengthM) : '',
    heightM: section.ceilingHeightM && section.ceilingHeightM > 0 ? String(section.ceilingHeightM) : '',
    areaM2: section.areaSqM && section.areaSqM > 0 ? String(section.areaSqM) : '',
  }));
  const stored = Array.isArray(meta.roomScans) ? meta.roomScans : [];
  if (!fromSections.length) return stored;
  const used = new Set<number>();
  const merged = fromSections.map((generated, index) => {
    const matchIndex = stored.findIndex((item, storedIndex) => {
      if (used.has(storedIndex)) return false;
      if (item.id && generated.id && item.id === generated.id) return true;
      if (typeof item.sourceSectionIndex === 'number' && item.sourceSectionIndex === index) return true;
      return false;
    });
    const fallbackIndex = matchIndex < 0 ? stored.findIndex((_, storedIndex) => !used.has(storedIndex) && storedIndex === index) : matchIndex;
    if (fallbackIndex < 0) return generated;
    used.add(fallbackIndex);
    const match = stored[fallbackIndex];
    return {
      ...match,
      ...generated,
      id: match.id || generated.id,
      floorPlanPngUri: match.floorPlanPngUri,
      floorPlan3dUri: match.floorPlan3dUri,
      scanMeta: match.scanMeta,
      scannedAt: match.scannedAt,
    };
  });
  const extras = stored.filter((_, storedIndex) => !used.has(storedIndex));
  return extras.length ? [...merged, ...extras] : merged;
}

export function applyRoomDraftToScanMeta(
  meta: FloorPlanScanMeta,
  room: PropertyRoomScan,
): FloorPlanScanMeta {
  const width = Number(String(room.widthM || '').replace(',', '.'));
  const length = Number(String(room.lengthM || '').replace(',', '.'));
  const height = Number(String(room.heightM || '').replace(',', '.'));
  const area = Number(String(room.areaM2 || '').replace(',', '.'));
  const index = resolveRoomSectionIndex(meta, room);
  let next = applyRoomIdentityToScanMeta(meta, {
    sectionIndex: index,
    name: room.name,
    typeKey: room.typeKey,
  }) || meta;
  if (index != null && next.sections[index]) {
    const sections = next.sections.map((section, i) =>
      i === index
        ? {
            ...section,
            widthM: Number.isFinite(width) && width > 0 ? width : section.widthM,
            lengthM: Number.isFinite(length) && length > 0 ? length : section.lengthM,
            ceilingHeightM: Number.isFinite(height) && height > 0 ? height : section.ceilingHeightM,
            areaSqM: Number.isFinite(area) && area > 0 ? area : section.areaSqM,
            userAssigned: true,
          }
        : section,
    );
    next = { ...next, sections };
  }
  const roomScans = roomsFromScanMeta(next).map((item) =>
    item.id === room.id ||
    (typeof room.sourceSectionIndex === 'number' && item.sourceSectionIndex === room.sourceSectionIndex)
      ? { ...item, ...room, sourceSectionIndex: item.sourceSectionIndex ?? room.sourceSectionIndex }
      : item,
  );
  const hasRoom = roomScans.some(
    (item) =>
      item.id === room.id ||
      (typeof room.sourceSectionIndex === 'number' && item.sourceSectionIndex === room.sourceSectionIndex),
  );
  const nextRooms = hasRoom ? roomScans : [...roomScans, room];
  return {
    ...next,
    roomScans: nextRooms,
    roomCount: listingRoomCountFromRooms(nextRooms) || listingRoomCountFromSections(next.sections || []),
    roomAreaTotalSqM: livableAreaFromRooms(nextRooms),
    totalAreaSqM: totalUniqueAreaSqM(next.sections || [], next.walls || []),
  };
}