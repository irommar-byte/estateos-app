import type {
  FloorPlanScanMeta,
  RoomScanDetectedObject,
  RoomScanOpening,
  RoomScanSection,
  RoomScanWallSegment,
} from '../../types/roomScan';
import { getRoomScanSectionLabel } from './roomScanLabels';
export { deriveRoomDimensionsFromWalls } from './roomScanMeasurements';

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

const ROOM_FILL_COLORS = [
  'rgba(14,165,233,0.12)',
  'rgba(16,185,129,0.12)',
  'rgba(139,92,246,0.10)',
  'rgba(245,158,11,0.12)',
  'rgba(236,72,153,0.10)',
  'rgba(6,182,212,0.12)',
];

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
  stove: { fill: 'rgba(249,115,22,0.28)', stroke: '#ea580c' },
  oven: { fill: 'rgba(249,115,22,0.28)', stroke: '#ea580c' },
  refrigerator: { fill: 'rgba(14,165,233,0.22)', stroke: '#0284c7' },
  dishwasher: { fill: 'rgba(6,182,212,0.24)', stroke: '#0e7490' },
  sink: { fill: 'rgba(56,189,248,0.22)', stroke: '#0369a1' },
  washerDryer: { fill: 'rgba(99,102,241,0.22)', stroke: '#4f46e5' },
  toilet: { fill: 'rgba(45,212,191,0.22)', stroke: '#0f766e' },
  bathtub: { fill: 'rgba(34,211,238,0.22)', stroke: '#0e7490' },
  bed: { fill: 'rgba(168,85,247,0.22)', stroke: '#7c3aed' },
  sofa: { fill: 'rgba(244,63,94,0.20)', stroke: '#e11d48' },
  table: { fill: 'rgba(245,158,11,0.24)', stroke: '#d97706' },
  chair: { fill: 'rgba(251,191,36,0.24)', stroke: '#b45309' },
  television: { fill: 'rgba(15,23,42,0.18)', stroke: '#334155' },
  fireplace: { fill: 'rgba(239,68,68,0.22)', stroke: '#b91c1c' },
  storage: { fill: 'rgba(100,116,139,0.22)', stroke: '#475569' },
  stairs: { fill: 'rgba(148,163,184,0.28)', stroke: '#64748b' },
  unknown: { fill: 'rgba(148,163,184,0.18)', stroke: '#64748b' },
};

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

  return mapped;
}

export function mapSectionsForRender(
  sections: RoomScanSection[],
  bounds: FloorPlanScanMeta['bounds'],
  viewport: FloorPlanViewport,
): MappedSection[] {
  return sections.map((section, index) => {
    const p = mapFloorPlanPoint(section.centerX, section.centerZ, bounds, viewport);
    return {
      id: `room-${index}`,
      key: section.key,
      label: getRoomScanSectionLabel(section.key),
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

export function mapObjectsForRender(
  objects: FloorPlanScanMeta['objects'],
  bounds: FloorPlanScanMeta['bounds'],
  viewport: FloorPlanViewport,
): MappedObject[] {
  return dedupeDetectedObjects(objects || []).map((obj, index) => {
    const p = mapFloorPlanPoint(obj.centerX, obj.centerZ, bounds, viewport);
    const palette = OBJECT_FILL[obj.category] || OBJECT_FILL.unknown;
    const widthM = obj.widthM && obj.widthM > 0.2 ? obj.widthM : 0.55;
    const depthM = obj.depthM && obj.depthM > 0.2 ? obj.depthM : 0.4;
    return {
      id: obj.id || `obj-${index}`,
      category: obj.category,
      label: obj.label,
      glyph: OBJECT_GLYPH[obj.category] || OBJECT_GLYPH.unknown,
      widthPx: Math.max(14, Math.min(86, widthM * viewport.scale)),
      depthPx: Math.max(10, Math.min(72, depthM * viewport.scale)),
      rotationDeg: obj.rotationDeg || 0,
      fill: palette.fill,
      stroke: palette.stroke,
      ...p,
    };
  });
}

export function mapOpeningsForRender(
  openings: FloorPlanScanMeta['openings'],
  bounds: FloorPlanScanMeta['bounds'],
  viewport: FloorPlanViewport,
): MappedOpening[] {
  return (openings || []).map((opening, index) => ({
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

export function dedupeDetectedObjects(
  objects: RoomScanDetectedObject[],
  opts?: { maxStorage?: number },
): RoomScanDetectedObject[] {
  const maxStorage = opts?.maxStorage ?? 4;
  const sorted = [...(objects || [])].sort((a, b) => {
    const areaA = (a.widthM || 0.5) * (a.depthM || 0.4);
    const areaB = (b.widthM || 0.5) * (b.depthM || 0.4);
    return areaB - areaA;
  });
  const kept: RoomScanDetectedObject[] = [];
  for (const obj of sorted) {
    const mergeM = obj.category === 'storage' || obj.category === 'unknown' ? 0.58 : 0.32;
    const duplicate = kept.some(
      (existing) =>
        (existing.category === obj.category ||
          (existing.category === 'storage' && obj.category === 'unknown') ||
          (existing.category === 'unknown' && obj.category === 'storage')) &&
        Math.hypot(existing.centerX - obj.centerX, existing.centerZ - obj.centerZ) < mergeM,
    );
    if (duplicate) continue;
    kept.push({
      ...obj,
      label: obj.label || obj.category,
    });
  }
  const storage = kept.filter((obj) => obj.category === 'storage');
  if (storage.length <= maxStorage) return kept;
  const keepIds = new Set(storage.slice(0, maxStorage).map((obj) => obj.id));
  return kept.filter((obj) => obj.category !== 'storage' || keepIds.has(obj.id));
}

export type DimensionSegment = {
  id: string;
  a: { x: number; y: number };
  b: { x: number; y: number };
  label: string;
  lx: number;
  ly: number;
  kind: 'wall' | 'opening';
};

export type DimensionChain = {
  id: string;
  overall: DimensionSegment;
  segments: DimensionSegment[];
};

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

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function offsetPoint(
  x: number,
  y: number,
  nx: number,
  ny: number,
  dist: number,
) {
  return { x: x + nx * dist, y: y + ny * dist };
}

function dimLabel(a: { x: number; y: number }, b: { x: number; y: number }, nx: number, ny: number, extra: number) {
  return {
    lx: (a.x + b.x) / 2 + nx * extra,
    ly: (a.y + b.y) / 2 + ny * extra,
  };
}

/**
 * Łańcuchy wymiarowe jak na profesjonalnym rzucie: odcinki ściana→otwór,
 * szerokość otworu, otwór→ściana oraz wymiar ogólny dalej na zewnątrz.
 */
export function buildWallDimensionChains(
  walls: RoomScanWallSegment[],
  openings: RoomScanOpening[],
  bounds: FloorPlanScanMeta['bounds'],
  viewport: FloorPlanViewport,
): DimensionChain[] {
  const significant = dedupeWallSegments(walls).filter((wall) => wallLengthMeters(wall) >= 1.15);
  const used = new Set<string>();
  const chains: DimensionChain[] = [];
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;

  significant
    .sort((a, b) => wallLengthMeters(b) - wallLengthMeters(a))
    .slice(0, 6)
    .forEach((wall, wallIndex) => {
      const key = [wall.x1.toFixed(2), wall.z1.toFixed(2), wall.x2.toFixed(2), wall.z2.toFixed(2)].join(':');
      if (used.has(key)) return;
      used.add(key);

      const midX = (wall.x1 + wall.x2) / 2;
      const midZ = (wall.z1 + wall.z2) / 2;
      const wallDx = wall.x2 - wall.x1;
      const wallDz = wall.z2 - wall.z1;
      const wallLen = Math.hypot(wallDx, wallDz) || 1;
      const toCenterX = cx - midX;
      const toCenterZ = cz - midZ;
      const side = wallDx * toCenterZ - wallDz * toCenterX >= 0 ? 1 : -1;
      const nxM = ((-wallDz / wallLen) * side);
      const nzM = ((wallDx / wallLen) * side);

      const hits = (openings || [])
        .map((opening) => {
          const ox = (opening.x1 + opening.x2) / 2;
          const oz = (opening.z1 + opening.z2) / 2;
          const dist = distToWall(ox, oz, wall);
          if (dist > 0.32) return null;
          const t0 = Math.max(0, Math.min(1, projectT(opening.x1, opening.z1, wall)));
          const t1 = Math.max(0, Math.min(1, projectT(opening.x2, opening.z2, wall)));
          const from = Math.min(t0, t1);
          const to = Math.max(t0, t1);
          if (to - from < 0.04) return null;
          return { from, to, kind: opening.kind || 'opening' };
        })
        .filter((row): row is { from: number; to: number; kind: string } => Boolean(row))
        .sort((a, b) => a.from - b.from);

      const cuts: Array<{ from: number; to: number; kind: 'wall' | 'opening' }> = [];
      let cursor = 0;
      for (const hit of hits) {
        if (hit.from - cursor > 0.035) cuts.push({ from: cursor, to: hit.from, kind: 'wall' });
        cuts.push({ from: hit.from, to: hit.to, kind: 'opening' });
        cursor = hit.to;
      }
      if (1 - cursor > 0.035) cuts.push({ from: cursor, to: 1, kind: 'wall' });
      if (!cuts.length) cuts.push({ from: 0, to: 1, kind: 'wall' });

      const a0 = mapFloorPlanPoint(wall.x1, wall.z1, bounds, viewport);
      const b0 = mapFloorPlanPoint(wall.x2, wall.z2, bounds, viewport);
      const pxDx = b0.x - a0.x;
      const pxDy = b0.y - a0.y;
      const pxLen = Math.hypot(pxDx, pxDy) || 1;
      const nx = -pxDy / pxLen;
      const ny = pxDx / pxLen;
      const outward = nx * (viewport.offsetX + (cx - bounds.minX) * viewport.scale - (a0.x + b0.x) / 2) +
        ny * (viewport.offsetY + (cz - bounds.minZ) * viewport.scale - (a0.y + b0.y) / 2);
      const sign = outward > 0 ? -1 : 1;
      const innerOff = 18 * sign;
      const outerOff = 34 * sign;

      const worldPoint = (t: number) =>
        mapFloorPlanPoint(lerp(wall.x1, wall.x2, t), lerp(wall.z1, wall.z2, t), bounds, viewport);

      const segments: DimensionSegment[] = cuts.map((cut, i) => {
        const a = worldPoint(cut.from);
        const b = worldPoint(cut.to);
        const oa = offsetPoint(a.x, a.y, nx * sign, ny * sign, innerOff);
        const ob = offsetPoint(b.x, b.y, nx * sign, ny * sign, innerOff);
        const meters = wallLen * (cut.to - cut.from);
        const mid = dimLabel(oa, ob, nx * sign, ny * sign, 10);
        return {
          id: `dim-${wallIndex}-${i}`,
          a: oa,
          b: ob,
          label: formatWallDimension(meters),
          lx: mid.lx,
          ly: mid.ly,
          kind: cut.kind,
        };
      });

      const oa = offsetPoint(a0.x, a0.y, nx * sign, ny * sign, outerOff);
      const ob = offsetPoint(b0.x, b0.y, nx * sign, ny * sign, outerOff);
      const omid = dimLabel(oa, ob, nx * sign, ny * sign, 11);
      chains.push({
        id: `chain-${wallIndex}`,
        overall: {
          id: `dim-${wallIndex}-all`,
          a: oa,
          b: ob,
          label: formatWallDimension(wallLen),
          lx: omid.lx,
          ly: omid.ly,
          kind: 'wall',
        },
        segments,
      });
      void nxM;
      void nzM;
    });

  return chains;
}
