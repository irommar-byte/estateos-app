import type { FloorPlanScanMeta, RoomScanWallSegment } from '../../types/roomScan';

function segmentLength(wall: RoomScanWallSegment): number {
  if (typeof wall.lengthM === 'number' && wall.lengthM > 0) return wall.lengthM;
  return Math.hypot(wall.x2 - wall.x1, wall.z2 - wall.z1);
}

function uniqueWalls(walls: RoomScanWallSegment[], tolerance = 0.08): RoomScanWallSegment[] {
  const result: RoomScanWallSegment[] = [];
  for (const wall of walls) {
    const duplicate = result.some(
      (existing) =>
        (Math.hypot(existing.x1 - wall.x1, existing.z1 - wall.z1) < tolerance &&
          Math.hypot(existing.x2 - wall.x2, existing.z2 - wall.z2) < tolerance) ||
        (Math.hypot(existing.x1 - wall.x2, existing.z1 - wall.z2) < tolerance &&
          Math.hypot(existing.x2 - wall.x1, existing.z2 - wall.z1) < tolerance),
    );
    if (!duplicate) result.push(wall);
  }
  return result;
}

/**
 * Gabaryty w lokalnej osi ścian. Nie zawyża wymiarów pokoju tylko dlatego,
 * że użytkownik rozpoczął skan pod kątem do osi świata AR.
 */
export function deriveRoomDimensionsFromWalls(
  walls: RoomScanWallSegment[],
): { widthM: number; lengthM: number } | null {
  const deduped = uniqueWalls(walls).filter((wall) => segmentLength(wall) >= 0.65);
  if (deduped.length < 2) return null;

  const dominant = [...deduped].sort((a, b) => segmentLength(b) - segmentLength(a))[0];
  const dx = dominant.x2 - dominant.x1;
  const dz = dominant.z2 - dominant.z1;
  const magnitude = Math.hypot(dx, dz);
  if (magnitude < 0.01) return null;

  const ux = dx / magnitude;
  const uz = dz / magnitude;
  const vx = -uz;
  const vz = ux;
  const points = deduped.flatMap((wall) => [
    { x: wall.x1, z: wall.z1 },
    { x: wall.x2, z: wall.z2 },
  ]);
  const along = points.map((point) => point.x * ux + point.z * uz);
  const across = points.map((point) => point.x * vx + point.z * vz);
  const sideA = Math.max(...along) - Math.min(...along);
  const sideB = Math.max(...across) - Math.min(...across);
  if (sideA < 0.3 || sideB < 0.3) return null;

  return {
    widthM: Number(Math.min(sideA, sideB).toFixed(2)),
    lengthM: Number(Math.max(sideA, sideB).toFixed(2)),
  };
}

export function wallsFootprintSqM(walls: RoomScanWallSegment[]): number {
  const deduped = uniqueWalls(walls);
  if (!deduped.length) return 0;
  const xs = deduped.flatMap((w) => [w.x1, w.x2]);
  const zs = deduped.flatMap((w) => [w.z1, w.z2]);
  return Math.max(0, (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs)));
}

export function estimateFloorAreaFromWalls(walls: RoomScanWallSegment[]): number {
  const bbox = wallsFootprintSqM(walls);
  const dims = deriveRoomDimensionsFromWalls(walls);
  if (dims) {
    const rect = dims.widthM * dims.lengthM;
    if (bbox > 0 && rect >= bbox * 0.42 && rect <= bbox * 1.05) return rect;
  }
  return bbox;
}

export function measurementsFromScanMeta(meta: FloorPlanScanMeta): {
  widthM: string;
  lengthM: string;
  heightM: string;
  areaM2: string;
} {
  const section = meta.sections[0];
  const fromWalls = deriveRoomDimensionsFromWalls(meta.walls);
  const width = section?.widthM ?? fromWalls?.widthM;
  const length = section?.lengthM ?? fromWalls?.lengthM;
  const height = section?.ceilingHeightM ?? meta.ceilingHeightM;
  const area = section?.areaSqM ?? meta.totalAreaSqM ?? (width && length ? width * length : undefined);
  const fmt = (value?: number | null, digits = 2) =>
    value && value > 0 ? value.toFixed(digits) : '';
  return {
    widthM: fmt(width),
    lengthM: fmt(length),
    heightM: fmt(height),
    areaM2: fmt(area, 1),
  };
}
