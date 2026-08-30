import type {
  FloorPlanScanMeta,
  RoomScanOpening,
  RoomScanSection,
  RoomScanWallSegment,
} from '@/types/roomScan';
import type { Locale } from '@/i18n/config';
import { getRoomScanSectionLabel } from '@/lib/roomScan/roomScanLabels';

export type FloorPlanViewport = {
  scale: number;
  offsetX: number;
  offsetY: number;
  padding: number;
};

export type MappedWall = {
  id: string;
  a: { x: number; y: number };
  b: { x: number; y: number };
  lx: number;
  ly: number;
  len: number;
  showLabel: boolean;
};

export type MappedSection = {
  id: string;
  key: string;
  label: string;
  centerX: number;
  centerZ: number;
  areaSqM?: number;
  widthM?: number;
  lengthM?: number;
  ceilingHeightM?: number;
  x: number;
  y: number;
  fill: string;
};

export type MappedObject = {
  id: string;
  category: string;
  label: string;
  x: number;
  y: number;
  glyph: string;
  widthPx: number;
  depthPx: number;
  rotationDeg: number;
  fill: string;
  stroke: string;
};

export type MappedOpening = {
  id: string;
  kind: string;
  a: { x: number; y: number };
  b: { x: number; y: number };
};

const OBJECT_GLYPH: Record<string, string> = {
  stove: 'Kuchenka',
  oven: 'Piekarnik',
  refrigerator: 'Lodówka',
  dishwasher: 'Zmywarka',
  sink: 'Zlew',
  washerDryer: 'Pralka',
  toilet: 'WC',
  bathtub: 'Wanna',
  bed: 'Łóżko',
  sofa: 'Sofa',
  table: 'Stół',
  chair: 'Krzesło',
  television: 'TV',
  fireplace: 'Kominek',
  storage: 'Szafa',
  stairs: 'Schody',
  unknown: '•',
};

const OBJECT_FILL: Record<string, { fill: string; stroke: string }> = {
  stove: { fill: 'rgba(249,115,22,0.28)', stroke: '#fb923c' },
  oven: { fill: 'rgba(249,115,22,0.28)', stroke: '#fb923c' },
  refrigerator: { fill: 'rgba(56,189,248,0.22)', stroke: '#38bdf8' },
  dishwasher: { fill: 'rgba(6,182,212,0.24)', stroke: '#22d3ee' },
  sink: { fill: 'rgba(56,189,248,0.22)', stroke: '#7dd3fc' },
  washerDryer: { fill: 'rgba(129,140,248,0.24)', stroke: '#818cf8' },
  toilet: { fill: 'rgba(45,212,191,0.22)', stroke: '#2dd4bf' },
  bathtub: { fill: 'rgba(34,211,238,0.22)', stroke: '#22d3ee' },
  bed: { fill: 'rgba(168,85,247,0.22)', stroke: '#c084fc' },
  sofa: { fill: 'rgba(244,63,94,0.22)', stroke: '#fb7185' },
  table: { fill: 'rgba(245,158,11,0.24)', stroke: '#fbbf24' },
  chair: { fill: 'rgba(251,191,36,0.24)', stroke: '#facc15' },
  television: { fill: 'rgba(148,163,184,0.22)', stroke: '#94a3b8' },
  fireplace: { fill: 'rgba(239,68,68,0.24)', stroke: '#f87171' },
  storage: { fill: 'rgba(148,163,184,0.22)', stroke: '#94a3b8' },
  stairs: { fill: 'rgba(148,163,184,0.28)', stroke: '#cbd5e1' },
  unknown: { fill: 'rgba(148,163,184,0.18)', stroke: '#94a3b8' },
};

export function deriveRoomDimensionsFromWalls(
  walls: RoomScanWallSegment[],
): { widthM: number; lengthM: number } | null {
  const deduped = dedupeWallSegments(walls).filter((wall) => wallLengthMeters(wall) >= 0.65);
  if (deduped.length < 2) return null;
  const dominant = [...deduped].sort((a, b) => wallLengthMeters(b) - wallLengthMeters(a))[0];
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

const ROOM_FILL_COLORS = [
  'rgba(56,189,248,0.14)',
  'rgba(52,211,153,0.14)',
  'rgba(167,139,250,0.14)',
  'rgba(251,191,36,0.14)',
  'rgba(244,114,182,0.14)',
  'rgba(94,234,212,0.14)',
];

export function wallLengthMeters(wall: RoomScanWallSegment): number {
  if (typeof wall.lengthM === 'number' && wall.lengthM > 0) return wall.lengthM;
  const dx = wall.x2 - wall.x1;
  const dz = wall.z2 - wall.z1;
  return Math.sqrt(dx * dx + dz * dz);
}

export function buildFloorPlanViewport(
  bounds: FloorPlanScanMeta['bounds'],
  width: number,
  height: number,
  padding: number,
): FloorPlanViewport {
  const spanX = Math.max(0.01, bounds.maxX - bounds.minX);
  const spanZ = Math.max(0.01, bounds.maxZ - bounds.minZ);
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const scale = Math.min(innerW / spanX, innerH / spanZ);
  const offsetX = padding + (innerW - spanX * scale) / 2;
  const offsetY = padding + (innerH - spanZ * scale) / 2;
  return { scale, offsetX, offsetY, padding };
}

export function mapFloorPlanPoint(
  x: number,
  z: number,
  bounds: FloorPlanScanMeta['bounds'],
  viewport: FloorPlanViewport,
) {
  return {
    x: viewport.offsetX + (x - bounds.minX) * viewport.scale,
    y: viewport.offsetY + (z - bounds.minZ) * viewport.scale,
  };
}

export function formatWallDimension(meters: number): string {
  if (meters >= 10) return `${meters.toFixed(1)} m`;
  if (meters >= 1) return `${meters.toFixed(2)} m`;
  return `${(meters * 100).toFixed(0)} cm`;
}

export function dedupeWallSegments(walls: RoomScanWallSegment[], tolerance = 0.08): RoomScanWallSegment[] {
  const out: RoomScanWallSegment[] = [];
  for (const wall of walls) {
    const len = wallLengthMeters(wall);
    const dup = out.some((existing) => {
      const sameDir =
        (Math.hypot(existing.x1 - wall.x1, existing.z1 - wall.z1) < tolerance &&
          Math.hypot(existing.x2 - wall.x2, existing.z2 - wall.z2) < tolerance) ||
        (Math.hypot(existing.x1 - wall.x2, existing.z1 - wall.z2) < tolerance &&
          Math.hypot(existing.x2 - wall.x1, existing.z2 - wall.z1) < tolerance);
      return sameDir && Math.abs(wallLengthMeters(existing) - len) < tolerance;
    });
    if (!dup) out.push({ ...wall, lengthM: len });
  }
  return out;
}

export function dedupeRoomSections(sections: RoomScanSection[], minDistanceM = 1.35): RoomScanSection[] {
  const out: RoomScanSection[] = [];
  for (const section of sections) {
    const nearIdx = out.findIndex(
      (existing) =>
        Math.hypot(existing.centerX - section.centerX, existing.centerZ - section.centerZ) < minDistanceM,
    );
    if (nearIdx >= 0) {
      const existing = out[nearIdx];
      if (existing.key === 'unspecified' && section.key !== 'unspecified') {
        out[nearIdx] = section;
      }
      continue;
    }
    out.push(section);
  }
  return out;
}

export function footprintFromWalls(walls: RoomScanWallSegment[]): number {
  if (!walls.length) return 0;
  const xs = walls.flatMap((w) => [w.x1, w.x2]);
  const zs = walls.flatMap((w) => [w.z1, w.z2]);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanZ = Math.max(...zs) - Math.min(...zs);
  return Math.max(0, spanX * spanZ);
}

/** Metraż z długości ścian — ignoruje krótkie segmenty (drzwi/szum), bbox tylko jako fallback. */
export function estimateFloorAreaFromWalls(walls: RoomScanWallSegment[]): number {
  const deduped = dedupeWallSegments(walls);
  if (!deduped.length) return 0;

  const bboxArea = footprintFromWalls(deduped);
  const MIN_WALL_M = 1.2;
  const significant = deduped.map(wallLengthMeters).filter((l) => l >= MIN_WALL_M);

  if (significant.length >= 2) {
    const clusters = clusterWallLengthMeans(significant, 0.35);
    if (clusters.length >= 2) {
      const rectArea = clusters[0] * clusters[clusters.length - 1];
      if (isPlausibleRoomArea(rectArea, bboxArea)) return rectArea;
    }

    const unique = uniqueWallLengths(significant, 0.15);
    if (unique.length >= 2) {
      const rectArea = unique[0] * unique[unique.length - 1];
      if (isPlausibleRoomArea(rectArea, bboxArea)) return rectArea;
    }
  }

  return bboxArea;
}

function uniqueWallLengths(lengths: number[], tolerance: number): number[] {
  const unique: number[] = [];
  for (const len of [...lengths].sort((a, b) => a - b)) {
    if (!unique.some((u) => Math.abs(u - len) <= tolerance)) unique.push(len);
  }
  return unique;
}

function clusterWallLengthMeans(lengths: number[], tolerance: number): number[] {
  const groups: number[][] = [];
  for (const len of [...lengths].sort((a, b) => a - b)) {
    const target = groups.find((group) => {
      const mean = group.reduce((sum, v) => sum + v, 0) / group.length;
      return Math.abs(mean - len) <= tolerance;
    });
    if (target) target.push(len);
    else groups.push([len]);
  }
  return groups
    .map((group) => group.reduce((sum, v) => sum + v, 0) / group.length)
    .sort((a, b) => a - b);
}

function isPlausibleRoomArea(rectArea: number, bboxArea: number): boolean {
  if (rectArea <= 0 || bboxArea <= 0) return false;
  // Odrzuca np. 0.5 m (otwór drzwi) × 4.9 m ≈ 2.8 m²
  if (rectArea < bboxArea * 0.42) return false;
  // Dla obróconego pokoju bbox zawyża — produkt boków może być wyraźnie mniejszy
  return rectArea <= bboxArea * 1.05;
}

export function mapWallsForRender(
  walls: RoomScanWallSegment[],
  bounds: FloorPlanScanMeta['bounds'],
  viewport: FloorPlanViewport,
  forExport?: boolean,
): MappedWall[] {
  const mapped = walls.map((wall, index) => {
    const a = mapFloorPlanPoint(wall.x1, wall.z1, bounds, viewport);
    const b = mapFloorPlanPoint(wall.x2, wall.z2, bounds, viewport);
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const len = wallLengthMeters(wall);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const labelOffset = forExport ? 18 : 14;
    const lx = midX + Math.sin(angle) * labelOffset;
    const ly = midY - Math.cos(angle) * labelOffset;
    return { id: `w-${index}`, a, b, midX, midY, lx, ly, len, showLabel: false };
  });

  const candidates = mapped
    .filter((w) => w.len >= 0.85)
    .sort((a, b) => b.len - a.len)
    .slice(0, forExport ? 10 : 7);

  const labeledIds = new Set(candidates.map((w) => w.id));
  return mapped.map((wall) => ({
    ...wall,
    showLabel: labeledIds.has(wall.id),
  }));
}

export function mapSectionsForRender(
  sections: RoomScanSection[],
  bounds: FloorPlanScanMeta['bounds'],
  viewport: FloorPlanViewport,
  locale: Locale,
): MappedSection[] {
  return sections.map((section, index) => {
    const p = mapFloorPlanPoint(section.centerX, section.centerZ, bounds, viewport);
    return {
      id: `room-${index}`,
      key: section.key,
      label: (section.label && section.label.trim()) || getRoomScanSectionLabel(section.key, locale),
      centerX: section.centerX,
      centerZ: section.centerZ,
      areaSqM: section.areaSqM,
      widthM: section.widthM,
      lengthM: section.lengthM,
      ceilingHeightM: section.ceilingHeightM,
      fill: ROOM_FILL_COLORS[index % ROOM_FILL_COLORS.length],
      ...p,
    };
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function mapObjectsForRender(
  objects: FloorPlanScanMeta['objects'],
  bounds: FloorPlanScanMeta['bounds'],
  viewport: FloorPlanViewport,
): MappedObject[] {
  const maxSidePx = Math.min(52, Math.max(28, viewport.scale * 1.15));
  const out: MappedObject[] = [];
  (objects || []).forEach((obj, index) => {
    const p = mapFloorPlanPoint(obj.centerX, obj.centerZ, bounds, viewport);
    const palette = OBJECT_FILL[obj.category] || OBJECT_FILL.unknown;
    const widthM = clamp(obj.widthM && obj.widthM > 0.2 ? obj.widthM : 0.55, 0.32, 2.1);
    const depthM = clamp(obj.depthM && obj.depthM > 0.2 ? obj.depthM : 0.4, 0.28, 1.05);
    if (widthM * depthM > 3.8 && obj.category !== 'bed' && obj.category !== 'sofa') return;
    out.push({
      id: obj.id || `obj-${index}`,
      category: obj.category,
      label: obj.label,
      glyph: OBJECT_GLYPH[obj.category] || OBJECT_GLYPH.unknown,
      widthPx: clamp(widthM * viewport.scale, 16, maxSidePx),
      depthPx: clamp(depthM * viewport.scale, 12, maxSidePx * 0.72),
      rotationDeg: obj.rotationDeg || 0,
      fill: palette.fill,
      stroke: palette.stroke,
      ...p,
    });
  });
  return out;
}

export function mapOpeningsForRender(
  openings: RoomScanOpening[] | undefined,
  bounds: FloorPlanScanMeta['bounds'],
  viewport: FloorPlanViewport,
): MappedOpening[] {
  return (openings || [])
    .filter((opening) => Math.hypot(opening.x2 - opening.x1, opening.z2 - opening.z1) >= 0.38)
    .map((opening, index) => ({
      id: opening.id || `op-${index}`,
      kind: opening.kind,
      a: mapFloorPlanPoint(opening.x1, opening.z1, bounds, viewport),
      b: mapFloorPlanPoint(opening.x2, opening.z2, bounds, viewport),
    }));
}

export function sectionMarkerRadiusPx(viewport: FloorPlanViewport, areaSqM?: number): number {
  const area = areaSqM && areaSqM > 0 ? areaSqM : 8;
  const sideM = Math.sqrt(area);
  return Math.max(20, Math.min(44, sideM * viewport.scale * 0.24));
}

function projectT(px: number, pz: number, wall: RoomScanWallSegment): number {
  const dx = wall.x2 - wall.x1;
  const dz = wall.z2 - wall.z1;
  const len2 = dx * dx + dz * dz || 1;
  return ((px - wall.x1) * dx + (pz - wall.z1) * dz) / len2;
}

function distToWall(px: number, pz: number, wall: RoomScanWallSegment): number {
  const t = Math.max(0, Math.min(1, projectT(px, pz, wall)));
  const qx = wall.x1 + (wall.x2 - wall.x1) * t;
  const qz = wall.z1 + (wall.z2 - wall.z1) * t;
  return Math.hypot(px - qx, pz - qz);
}

export function snapWallEndpoints(
  walls: RoomScanWallSegment[],
  snapM = 0.24,
): RoomScanWallSegment[] {
  const cluster: Array<{ x: number; z: number }> = [];
  const snap = (x: number, z: number) => {
    const hit = cluster.find((p) => Math.hypot(p.x - x, p.z - z) <= snapM);
    if (hit) return hit;
    const next = { x, z };
    cluster.push(next);
    return next;
  };
  return dedupeWallSegments(walls)
    .map((wall) => {
      const a = snap(wall.x1, wall.z1);
      const b = snap(wall.x2, wall.z2);
      return {
        ...wall,
        x1: a.x,
        z1: a.z,
        x2: b.x,
        z2: b.z,
        lengthM: Math.hypot(b.x - a.x, b.z - a.z),
      };
    })
    .filter((wall) => wallLengthMeters(wall) > 0.08);
}

function wallUnit(wall: RoomScanWallSegment) {
  const dx = wall.x2 - wall.x1;
  const dz = wall.z2 - wall.z1;
  const len = Math.hypot(dx, dz) || 1;
  return { dx: dx / len, dz: dz / len, len };
}

function wallsParallel(a: RoomScanWallSegment, b: RoomScanWallSegment, minDot = 0.94) {
  const ua = wallUnit(a);
  const ub = wallUnit(b);
  return Math.abs(ua.dx * ub.dx + ua.dz * ub.dz) >= minDot;
}

export function cleanWallsForPlan(walls: RoomScanWallSegment[]): RoomScanWallSegment[] {
  const snapped = snapWallEndpoints(walls, 0.24);
  const longEnough = snapped.filter((wall) => wallLengthMeters(wall) >= 0.42);
  const source = longEnough.length >= 3 ? longEnough : snapped;
  const ranked = [...source].sort((a, b) => wallLengthMeters(b) - wallLengthMeters(a));
  const kept: RoomScanWallSegment[] = [];
  for (const wall of ranked) {
    const mid = { x: (wall.x1 + wall.x2) / 2, z: (wall.z1 + wall.z2) / 2 };
    const inner = kept.some((outer) => {
      if (!wallsParallel(wall, outer)) return false;
      if (distToWall(mid.x, mid.z, outer) > 0.42) return false;
      const t1 = projectT(wall.x1, wall.z1, outer);
      const t2 = projectT(wall.x2, wall.z2, outer);
      const overlap = Math.min(1, Math.max(t1, t2)) - Math.max(0, Math.min(t1, t2));
      return overlap > 0.32;
    });
    if (!inner) kept.push(wall);
  }
  return kept;
}

export type WallRenderPath = { id: string; d: string };

export function buildWallRenderPaths(
  walls: RoomScanWallSegment[],
  bounds: FloorPlanScanMeta['bounds'],
  viewport: FloorPlanViewport,
): WallRenderPath[] {
  const snapped = cleanWallsForPlan(walls);
  const keyOf = (x: number, z: number) => `${x.toFixed(3)}:${z.toFixed(3)}`;
  const unused = new Set(snapped.map((_, index) => index));
  const paths: WallRenderPath[] = [];

  const takeNext = (x: number, z: number) => {
    const key = keyOf(x, z);
    for (const index of unused) {
      const wall = snapped[index];
      if (keyOf(wall.x1, wall.z1) === key) {
        unused.delete(index);
        return { x: wall.x2, z: wall.z2 };
      }
      if (keyOf(wall.x2, wall.z2) === key) {
        unused.delete(index);
        return { x: wall.x1, z: wall.z1 };
      }
    }
    return null;
  };

  let pathId = 0;
  while (unused.size) {
    const start = unused.values().next().value as number;
    unused.delete(start);
    const first = snapped[start];
    const points = [
      { x: first.x1, z: first.z1 },
      { x: first.x2, z: first.z2 },
    ];
    while (true) {
      const last = points[points.length - 1];
      const next = takeNext(last.x, last.z);
      if (!next) break;
      points.push(next);
    }
    while (true) {
      const head = points[0];
      const prev = takeNext(head.x, head.z);
      if (!prev) break;
      points.unshift(prev);
    }
    const closed =
      points.length > 2 &&
      keyOf(points[0].x, points[0].z) === keyOf(points[points.length - 1].x, points[points.length - 1].z);
    const mapped = points.map((point) => mapFloorPlanPoint(point.x, point.z, bounds, viewport));
    const d =
      mapped.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ') +
      (closed ? ' Z' : '');
    paths.push({ id: `wall-path-${pathId}`, d });
    pathId += 1;
  }
  return paths;
}

export type PlanDimLabel = {
  id: string;
  x: number;
  y: number;
  text: string;
  kind: 'wall' | 'window' | 'door' | 'opening';
};

function nearlySameWall(a: RoomScanWallSegment, b: RoomScanWallSegment): boolean {
  const midA = { x: (a.x1 + a.x2) / 2, z: (a.z1 + a.z2) / 2 };
  const midB = { x: (b.x1 + b.x2) / 2, z: (b.z1 + b.z2) / 2 };
  return Math.hypot(midA.x - midB.x, midA.z - midB.z) < 0.45 && Math.abs(wallLengthMeters(a) - wallLengthMeters(b)) < 0.35;
}

function canvasSizeFromViewport(bounds: FloorPlanScanMeta['bounds'], viewport: FloorPlanViewport) {
  return {
    w: 2 * viewport.offsetX + (bounds.maxX - bounds.minX) * viewport.scale,
    h: 2 * viewport.offsetY + (bounds.maxZ - bounds.minZ) * viewport.scale,
  };
}

function placePlanLabels(
  labels: PlanDimLabel[],
  bounds: FloorPlanScanMeta['bounds'],
  viewport: FloorPlanViewport,
  avoid: Array<{ x: number; y: number }>,
): PlanDimLabel[] {
  const ranked = [...labels].sort((a, b) => (a.kind === 'wall' ? 0 : 1) - (b.kind === 'wall' ? 0 : 1));
  const { w, h } = canvasSizeFromViewport(bounds, viewport);
  const placed: PlanDimLabel[] = [];

  const clashes = (x: number, y: number, text: string) => {
    if (x < 16 || y < 16 || x > w - 16 || y > h - 16) return true;
    if (avoid.some((point) => Math.hypot(point.x - x, point.y - y) < 34)) return true;
    return placed.some((existing) => {
      const dist = Math.hypot(existing.x - x, existing.y - y);
      return dist < 26 || (existing.text === text && dist < 72);
    });
  };

  for (const label of ranked) {
    const candidates = [
      { x: label.x, y: label.y },
      { x: label.x + 18, y: label.y },
      { x: label.x - 18, y: label.y },
      { x: label.x, y: label.y + 16 },
      { x: label.x, y: label.y - 16 },
      { x: label.x + 24, y: label.y - 14 },
      { x: label.x - 24, y: label.y + 14 },
    ];
    const pick = candidates.find((candidate) => !clashes(candidate.x, candidate.y, label.text));
    if (!pick) continue;
    placed.push({ ...label, x: pick.x, y: pick.y });
  }
  return placed;
}

export function buildCleanPlanDimensions(
  walls: RoomScanWallSegment[],
  openings: RoomScanOpening[],
  bounds: FloorPlanScanMeta['bounds'],
  viewport: FloorPlanViewport,
  avoid: Array<{ x: number; y: number }> = [],
): PlanDimLabel[] {
  const unique = cleanWallsForPlan(walls).filter((wall) => wallLengthMeters(wall) >= 0.9);
  const picked: RoomScanWallSegment[] = [];
  for (const wall of unique.sort((a, b) => wallLengthMeters(b) - wallLengthMeters(a))) {
    if (picked.some((existing) => nearlySameWall(existing, wall))) continue;
    picked.push(wall);
    if (picked.length >= 8) break;
  }

  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const labels: PlanDimLabel[] = [];
  const usedOpenings = new Set<number>();

  picked.forEach((wall, wallIndex) => {
    const a0 = mapFloorPlanPoint(wall.x1, wall.z1, bounds, viewport);
    const b0 = mapFloorPlanPoint(wall.x2, wall.z2, bounds, viewport);
    const pxDx = b0.x - a0.x;
    const pxDy = b0.y - a0.y;
    const pxLen = Math.hypot(pxDx, pxDy) || 1;
    const nx = -pxDy / pxLen;
    const ny = pxDx / pxLen;
    const tx = pxDx / pxLen;
    const ty = pxDy / pxLen;
    const midX = (a0.x + b0.x) / 2;
    const midY = (a0.y + b0.y) / 2;
    const toCenter =
      nx * (viewport.offsetX + (cx - bounds.minX) * viewport.scale - midX) +
      ny * (viewport.offsetY + (cz - bounds.minZ) * viewport.scale - midY);
    const sign = toCenter > 0 ? -1 : 1;
    labels.push({
      id: `wall-len-${wallIndex}`,
      x: midX + nx * sign * 22,
      y: midY + ny * sign * 22,
      text: formatWallDimension(wallLengthMeters(wall)),
      kind: 'wall',
    });

    (openings || []).forEach((opening, openingIndex) => {
      if (usedOpenings.has(openingIndex)) return;
      const ox = (opening.x1 + opening.x2) / 2;
      const oz = (opening.z1 + opening.z2) / 2;
      if (distToWall(ox, oz, wall) > 0.28) return;
      const meters = Math.hypot(opening.x2 - opening.x1, opening.z2 - opening.z1);
      if (meters < 0.42) return;
      usedOpenings.add(openingIndex);
      const p = mapFloorPlanPoint(ox, oz, bounds, viewport);
      const along = Math.abs(projectT(ox, oz, wall) - 0.5) < 0.16 ? 18 : 0;
      labels.push({
        id: `open-len-${wallIndex}-${openingIndex}`,
        x: p.x - nx * sign * 10 + tx * along,
        y: p.y - ny * sign * 10 + ty * along,
        text: formatWallDimension(meters),
        kind: opening.kind === 'window' ? 'window' : opening.kind === 'door' ? 'door' : 'opening',
      });
    });
  });

  return placePlanLabels(labels, bounds, viewport, avoid);
}
