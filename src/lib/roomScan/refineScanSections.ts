import type {
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

  next = maybeAddHallway(next, walls, objects, ceilingHeightM);

  next = next.map((section) => {
    const localWalls = assignWallsToSection(section, next, walls);
    const dims = deriveRoomDimensionsFromWalls(localWalls.length >= 2 ? localWalls : walls);
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
          areaSqM: Number((w * l).toFixed(1)),
          ceilingHeightM: section.ceilingHeightM ?? ceilingHeightM ?? undefined,
        };
      }
    }
    return {
      ...section,
      widthM: dims?.widthM ?? section.widthM,
      lengthM: dims?.lengthM ?? section.lengthM,
      areaSqM: area > 0 ? Number(area.toFixed(1)) : section.areaSqM,
      ceilingHeightM: section.ceilingHeightM ?? ceilingHeightM ?? undefined,
    };
  });

  const sum = next.reduce((acc, s) => acc + (s.areaSqM || 0), 0);
  if (next.length > 1 && globalFootprint > 1 && sum > globalFootprint * 1.08) {
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
  const footprint = estimateFloorAreaFromWalls(walls);
  const sum = sections.reduce((acc, s) => acc + (typeof s.areaSqM === 'number' ? s.areaSqM : 0), 0);
  if (footprint > 0 && sections.length > 1) {
    if (sum <= 0) return Number(footprint.toFixed(1));
    return Number(Math.min(sum, footprint * 1.04).toFixed(1));
  }
  return Number((sum || footprint).toFixed(1));
}