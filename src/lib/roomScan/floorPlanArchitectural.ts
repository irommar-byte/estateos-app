import type {
  DimensionChain,
  DimensionSegment,
  FloorPlanViewport,
  MappedObject,
  MappedOpening,
  MappedSection,
} from './floorPlanGeometry';
import type { FloorPlanScanMeta, RoomScanOpening, RoomScanWallSegment } from '../../types/roomScan';
import {
  buildWallDimensionChains,
  cleanWallsForPlan,
  mapFloorPlanPoint,
  wallLengthMeters,
} from './floorPlanGeometry';

export function formatArchitecturalDimensionCm(meters: number): string {
  const cm = Math.round(meters * 100);
  return cm > 0 ? String(cm) : '0';
}

function rotateXZ(
  x: number,
  z: number,
  pivotX: number,
  pivotZ: number,
  cos: number,
  sin: number,
) {
  const dx = x - pivotX;
  const dz = z - pivotZ;
  return {
    x: pivotX + dx * cos - dz * sin,
    z: pivotZ + dx * sin + dz * cos,
  };
}

function boundsFromPoints(points: { x: number; z: number }[]) {
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}

function directionlessAxisAngle(angleRad: number): number {
  return Math.atan2(Math.sin(angleRad * 2), Math.cos(angleRad * 2)) / 2;
}

function snapSegmentToAxis(wall: RoomScanWallSegment, toleranceDeg = 14): RoomScanWallSegment {
  const dx = wall.x2 - wall.x1;
  const dz = wall.z2 - wall.z1;
  const angle = Math.atan2(dz, dx);
  const horizontalError = Math.abs(Math.sin(angle));
  const verticalError = Math.abs(Math.cos(angle));
  const tolerance = Math.sin((toleranceDeg * Math.PI) / 180);

  if (horizontalError <= tolerance) {
    const z = (wall.z1 + wall.z2) / 2;
    return {
      ...wall,
      z1: z,
      z2: z,
      lengthM: Math.abs(dx),
    };
  }

  if (verticalError <= tolerance) {
    const x = (wall.x1 + wall.x2) / 2;
    return {
      ...wall,
      x1: x,
      x2: x,
      lengthM: Math.abs(dz),
    };
  }

  return {
    ...wall,
    lengthM: Math.hypot(dx, dz),
  };
}

function isAxisAligned(wall: RoomScanWallSegment, toleranceDeg = 14): boolean {
  const angle = Math.atan2(wall.z2 - wall.z1, wall.x2 - wall.x1);
  const tolerance = Math.sin((toleranceDeg * Math.PI) / 180);
  return Math.abs(Math.sin(angle)) <= tolerance || Math.abs(Math.cos(angle)) <= tolerance;
}

function snapOpeningToBounds(
  opening: RoomScanOpening,
  bounds: FloorPlanScanMeta['bounds'],
): RoomScanOpening {
  const centerX = (opening.x1 + opening.x2) / 2;
  const centerZ = (opening.z1 + opening.z2) / 2;
  const distances = [
    { side: 'top' as const, value: Math.abs(centerZ - bounds.minZ) },
    { side: 'bottom' as const, value: Math.abs(centerZ - bounds.maxZ) },
    { side: 'left' as const, value: Math.abs(centerX - bounds.minX) },
    { side: 'right' as const, value: Math.abs(centerX - bounds.maxX) },
  ].sort((a, b) => a.value - b.value);
  const side = distances[0].side;
  const clipX = (x: number) => Math.max(bounds.minX, Math.min(bounds.maxX, x));
  const clipZ = (z: number) => Math.max(bounds.minZ, Math.min(bounds.maxZ, z));

  if (side === 'top' || side === 'bottom') {
    const z = side === 'top' ? bounds.minZ : bounds.maxZ;
    const x1 = clipX(opening.x1);
    const x2 = clipX(opening.x2);
    return { ...opening, x1, z1: z, x2, z2: z, lengthM: Math.abs(x2 - x1) };
  }

  const x = side === 'left' ? bounds.minX : bounds.maxX;
  const z1 = clipZ(opening.z1);
  const z2 = clipZ(opening.z2);
  return { ...opening, x1: x, z1, x2: x, z2, lengthM: Math.abs(z2 - z1) };
}

function sectionDimensions(section: FloorPlanScanMeta['sections'][number] | undefined) {
  const values = [section?.widthM, section?.lengthM]
    .filter((value): value is number => typeof value === 'number' && value > 0.4)
    .sort((a, b) => b - a);
  return values.length === 2 ? { width: values[0], height: values[1] } : null;
}

/**
 * Prostuje szum RoomPlan bez obracania rzutu o przypadkowe 180°. Dla pojedynczego,
 * prostokątnego pokoju buduje jeden kanoniczny obrys, dzięki czemu przeciwległe
 * ściany zawsze mają ten sam wymiar i domknięte narożniki.
 */
export function orthogonalizeScanPlan(
  walls: RoomScanWallSegment[],
  meta: FloorPlanScanMeta,
): { walls: RoomScanWallSegment[]; meta: FloorPlanScanMeta } {
  const cleaned = cleanWallsForPlan(walls);
  if (cleaned.length < 2) return { walls, meta };

  const pivotX = (meta.bounds.minX + meta.bounds.maxX) / 2;
  const pivotZ = (meta.bounds.minZ + meta.bounds.maxZ) / 2;
  const longest = [...cleaned].sort((a, b) => wallLengthMeters(b) - wallLengthMeters(a))[0];
  const angleRad = Math.atan2(longest.z2 - longest.z1, longest.x2 - longest.x1);
  const rotRad = -directionlessAxisAngle(angleRad);
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);
  const planRotationDeg = (rotRad * 180) / Math.PI;

  const rotatedWalls = walls.map((wall) => {
    const a = rotateXZ(wall.x1, wall.z1, pivotX, pivotZ, cos, sin);
    const b = rotateXZ(wall.x2, wall.z2, pivotX, pivotZ, cos, sin);
    return snapSegmentToAxis({
      ...wall,
      x1: a.x,
      z1: a.z,
      x2: b.x,
      z2: b.z,
      lengthM: Math.hypot(b.x - a.x, b.z - a.z),
    });
  });

  const rotatedOpenings = (meta.openings || []).map((opening) => {
    const a = rotateXZ(opening.x1, opening.z1, pivotX, pivotZ, cos, sin);
    const b = rotateXZ(opening.x2, opening.z2, pivotX, pivotZ, cos, sin);
    return snapSegmentToAxis({
      ...opening,
      x1: a.x,
      z1: a.z,
      x2: b.x,
      z2: b.z,
    }) as RoomScanOpening;
  });

  let nextSections = meta.sections.map((section) => {
    const p = rotateXZ(section.centerX, section.centerZ, pivotX, pivotZ, cos, sin);
    return { ...section, centerX: p.x, centerZ: p.z };
  });

  const nextObjects = (meta.objects || []).map((object) => {
    const p = rotateXZ(object.centerX, object.centerZ, pivotX, pivotZ, cos, sin);
    return {
      ...object,
      centerX: p.x,
      centerZ: p.z,
      rotationDeg: (object.rotationDeg || 0) + planRotationDeg,
    };
  });

  const cleanedRotated = cleanWallsForPlan(rotatedWalls);
  const initialBounds = boundsFromPoints(
    cleanedRotated.flatMap((wall) => [
      { x: wall.x1, z: wall.z1 },
      { x: wall.x2, z: wall.z2 },
    ]),
  );
  const spanX = initialBounds.maxX - initialBounds.minX;
  const spanZ = initialBounds.maxZ - initialBounds.minZ;
  const longWalls = cleanedRotated.filter((wall) => wallLengthMeters(wall) >= Math.min(spanX, spanZ) * 0.22);
  const boundaryTolerance = Math.max(0.12, Math.min(spanX, spanZ) * 0.045);
  const endpointBoundarySides = (x: number, z: number) => {
    const sides: string[] = [];
    if (Math.abs(x - initialBounds.minX) <= boundaryTolerance) sides.push('left');
    if (Math.abs(x - initialBounds.maxX) <= boundaryTolerance) sides.push('right');
    if (Math.abs(z - initialBounds.minZ) <= boundaryTolerance) sides.push('top');
    if (Math.abs(z - initialBounds.maxZ) <= boundaryTolerance) sides.push('bottom');
    return sides;
  };
  const horizontalCount = longWalls.filter(
    (wall) => Math.abs(wall.x2 - wall.x1) >= Math.abs(wall.z2 - wall.z1) * 3,
  ).length;
  const verticalCount = longWalls.filter(
    (wall) => Math.abs(wall.z2 - wall.z1) >= Math.abs(wall.x2 - wall.x1) * 3,
  ).length;
  const hasStructuralDiagonal = longWalls.some((wall) => {
    if (isAxisAligned(wall)) return false;
    const firstSides = endpointBoundarySides(wall.x1, wall.z1);
    const secondSides = endpointBoundarySides(wall.x2, wall.z2);
    // Prawdziwy skos obrysu (np. 102 cm ze wzorca kuchni) łączy dwie
    // różne krawędzie bbox. Luźny skośny odłamek wewnątrz pokoju to szum.
    return firstSides.some((first) => secondSides.some((second) => first !== second));
  });
  const oneRoom = meta.roomCount <= 1 && meta.sections.length <= 1;
  const rectangular = oneRoom && horizontalCount >= 2 && verticalCount >= 2 && !hasStructuralDiagonal;

  let nextWalls = cleanedRotated;
  let bounds = initialBounds;
  let nextOpenings = rotatedOpenings;

  if (rectangular) {
    const measured = sectionDimensions(nextSections[0]);
    const measuredPlausible =
      measured != null &&
      measured.width >= spanX * 0.72 &&
      measured.width <= spanX * 1.28 &&
      measured.height >= spanZ * 0.72 &&
      measured.height <= spanZ * 1.28;
    const widthM = measuredPlausible ? measured.width : spanX;
    const heightM = measuredPlausible ? measured.height : spanZ;
    const centerX = (initialBounds.minX + initialBounds.maxX) / 2;
    const centerZ = (initialBounds.minZ + initialBounds.maxZ) / 2;
    bounds = {
      minX: centerX - widthM / 2,
      maxX: centerX + widthM / 2,
      minZ: centerZ - heightM / 2,
      maxZ: centerZ + heightM / 2,
    };
    nextWalls = [
      { x1: bounds.minX, z1: bounds.minZ, x2: bounds.maxX, z2: bounds.minZ, lengthM: widthM },
      { x1: bounds.maxX, z1: bounds.minZ, x2: bounds.maxX, z2: bounds.maxZ, lengthM: heightM },
      { x1: bounds.maxX, z1: bounds.maxZ, x2: bounds.minX, z2: bounds.maxZ, lengthM: widthM },
      { x1: bounds.minX, z1: bounds.maxZ, x2: bounds.minX, z2: bounds.minZ, lengthM: heightM },
    ];
    nextOpenings = rotatedOpenings.map((opening) => snapOpeningToBounds(opening, bounds));
    nextSections = nextSections.map((section) => ({
      ...section,
      centerX,
      centerZ,
      widthM: Math.min(widthM, heightM),
      lengthM: Math.max(widthM, heightM),
    }));
  }

  const northRotationDegrees =
    meta.northRotationDegrees != null
      ? (((meta.northRotationDegrees + planRotationDeg) % 360) + 360) % 360
      : null;

  return {
    walls: nextWalls,
    meta: {
      ...meta,
      bounds,
      walls: nextWalls,
      openings: nextOpenings,
      sections: nextSections,
      objects: nextObjects,
      northRotationDegrees,
    },
  };
}

export type WallBandRender = {
  id: string;
  d: string;
  inner: { a: { x: number; y: number }; b: { x: number; y: number } };
  outer: { a: { x: number; y: number }; b: { x: number; y: number } };
};

export function buildArchitecturalWallBands(
  walls: RoomScanWallSegment[],
  bounds: FloorPlanScanMeta['bounds'],
  viewport: FloorPlanViewport,
): WallBandRender[] {
  const halfPx = Math.max(4, Math.min(11, viewport.scale * 0.095));
  const roomCenter = mapFloorPlanPoint(
    (bounds.minX + bounds.maxX) / 2,
    (bounds.minZ + bounds.maxZ) / 2,
    bounds,
    viewport,
  );
  const bands = cleanWallsForPlan(walls).map((wall) => {
    const a = mapFloorPlanPoint(wall.x1, wall.z1, bounds, viewport);
    const b = mapFloorPlanPoint(wall.x2, wall.z2, bounds, viewport);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const tangent = { x: dx / len, y: dy / len };
    const normal = { x: -dy / len, y: dx / len };
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const normalPointsInside =
      (roomCenter.x - mid.x) * normal.x + (roomCenter.y - mid.y) * normal.y >= 0;
    const inward = normalPointsInside ? normal : { x: -normal.x, y: -normal.y };
    return {
      center: { a, b },
      tangent,
      inner: {
        a: { x: a.x + inward.x * halfPx, y: a.y + inward.y * halfPx },
        b: { x: b.x + inward.x * halfPx, y: b.y + inward.y * halfPx },
      },
      outer: {
        a: { x: a.x - inward.x * halfPx, y: a.y - inward.y * halfPx },
        b: { x: b.x - inward.x * halfPx, y: b.y - inward.y * halfPx },
      },
    };
  });

  const lineIntersection = (
    a1: { x: number; y: number },
    a2: { x: number; y: number },
    b1: { x: number; y: number },
    b2: { x: number; y: number },
  ) => {
    const adx = a2.x - a1.x;
    const ady = a2.y - a1.y;
    const bdx = b2.x - b1.x;
    const bdy = b2.y - b1.y;
    const denominator = adx * bdy - ady * bdx;
    if (Math.abs(denominator) < 0.001) return null;
    const t = ((b1.x - a1.x) * bdy - (b1.y - a1.y) * bdx) / denominator;
    return { x: a1.x + adx * t, y: a1.y + ady * t };
  };

  const joinTolerance = Math.max(2, viewport.scale * 0.04);
  const joinedPoint = (
    bandIndex: number,
    edge: 'inner' | 'outer',
    endpoint: 'a' | 'b',
  ) => {
    const band = bands[bandIndex];
    const centerPoint = band.center[endpoint];
    const basePoint = band[edge][endpoint];
    let connectedParallel = false;

    for (let otherIndex = 0; otherIndex < bands.length; otherIndex += 1) {
      if (otherIndex === bandIndex) continue;
      const other = bands[otherIndex];
      for (const otherEndpoint of ['a', 'b'] as const) {
        const otherCenter = other.center[otherEndpoint];
        if (Math.hypot(otherCenter.x - centerPoint.x, otherCenter.y - centerPoint.y) > joinTolerance) {
          continue;
        }
        const cross = band.tangent.x * other.tangent.y - band.tangent.y * other.tangent.x;
        if (Math.abs(cross) < 0.03) {
          connectedParallel = true;
          continue;
        }
        const intersection = lineIntersection(
          band[edge].a,
          band[edge].b,
          other[edge].a,
          other[edge].b,
        );
        if (intersection && Math.hypot(intersection.x - basePoint.x, intersection.y - basePoint.y) <= halfPx * 3.5) {
          return intersection;
        }
      }
    }

    if (connectedParallel) return basePoint;
    const capDirection = endpoint === 'a' ? -1 : 1;
    return {
      x: basePoint.x + band.tangent.x * halfPx * capDirection,
      y: basePoint.y + band.tangent.y * halfPx * capDirection,
    };
  };

  return bands.map((band, index) => {
    const inner = {
      a: joinedPoint(index, 'inner', 'a'),
      b: joinedPoint(index, 'inner', 'b'),
    };
    const outer = {
      a: joinedPoint(index, 'outer', 'a'),
      b: joinedPoint(index, 'outer', 'b'),
    };
    const d = [
      `M ${inner.a.x.toFixed(1)} ${inner.a.y.toFixed(1)}`,
      `L ${inner.b.x.toFixed(1)} ${inner.b.y.toFixed(1)}`,
      `L ${outer.b.x.toFixed(1)} ${outer.b.y.toFixed(1)}`,
      `L ${outer.a.x.toFixed(1)} ${outer.a.y.toFixed(1)} Z`,
    ].join(' ');

    return { id: `wall-band-${index}`, d, inner, outer };
  });
}

export function dimensionSegmentsForRender(chain: DimensionChain): DimensionSegment[] {
  return chain.segments.length > 0 ? chain.segments : [chain.overall];
}

export function wrapLabelLines(label: string, maxLineLen = 18): string[] {
  const text = label.trim();
  if (!text) return [];
  if (text.length <= maxLineLen) return [text];

  const words = text.split(/\s+/);
  if (words.length === 1) {
    const mid = Math.ceil(text.length / 2);
    return [text.slice(0, mid), text.slice(mid)];
  }

  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${current} ${words[i]}`;
    if (candidate.length <= maxLineLen) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

export type SectionLabelLayout = {
  id: string;
  x: number;
  nameLines: string[];
  areaText: string | null;
  nameStartY: number;
  areaY: number;
};

/** Etykieta środka planu jak na rzucie arch.: metraż + opcjonalna czerwona nazwa (aneks). */
export function layoutArchitecturalCenterLabel(
  sections: MappedSection[],
  meta: FloorPlanScanMeta,
  center: { x: number; y: number },
  avoid: AvoidPoint[],
  opts?: {
    roomRect?: { left: number; right: number; top: number; bottom: number };
    nameFontSize?: number;
    nameLineHeight?: number;
    nameAreaGap?: number;
    areaFontSize?: number;
    areaLineHeight?: number;
  },
): SectionLabelLayout[] {
  const primary = sections[0];
  const areaValue =
    (typeof primary?.areaSqM === 'number' && primary.areaSqM > 0
      ? primary.areaSqM
      : meta.totalAreaSqM) ?? null;
  const areaText = areaValue && areaValue > 0 ? `${Number(areaValue).toFixed(2)} m²` : null;
  const showRedName =
    primary?.key === 'livingRoomKitchenette' ||
    Boolean(primary?.label && primary.label.length > 14 && /aneksem|kuchni/i.test(primary.label));
  const nameLines = showRedName && primary?.label ? wrapLabelLines(primary.label) : [];

  if (!areaText && !nameLines.length) return [];

  const nameFontSize = opts?.nameFontSize ?? 22;
  const nameLineHeight = opts?.nameLineHeight ?? nameFontSize * 1.02;
  const nameAreaGap = opts?.nameAreaGap ?? 4;
  const areaFontSize = opts?.areaFontSize ?? 13;
  const areaLineHeight = opts?.areaLineHeight ?? areaFontSize * 1.15;
  const blockHeight = labelBlockHeight(nameLines, areaText, nameLineHeight, nameAreaGap, areaLineHeight);
  const estimatedNameWidth = Math.max(
    0,
    ...nameLines.map((line) => line.length * nameFontSize * 0.48),
  );
  const estimatedAreaWidth = (areaText?.length || 0) * areaFontSize * 0.56;
  const halfW = Math.max(38, estimatedNameWidth / 2, estimatedAreaWidth / 2) + 5;
  const roomRect = opts?.roomRect;
  const roomWidth = roomRect ? roomRect.right - roomRect.left : 280;
  const roomHeight = roomRect ? roomRect.bottom - roomRect.top : 220;
  const stepX = Math.min(72, roomWidth * 0.16);
  const stepY = Math.min(56, roomHeight * 0.16);
  const offsets = [
    [0, 0],
    [0, -stepY],
    [0, stepY],
    [-stepX, 0],
    [stepX, 0],
    [-stepX, -stepY],
    [stepX, -stepY],
    [-stepX, stepY],
    [stepX, stepY],
    [0, -stepY * 2],
    [0, stepY * 2],
    [-stepX * 2, 0],
    [stepX * 2, 0],
  ];
  const candidates = offsets
    .map(([dx, dy]) => ({ x: center.x + dx, y: center.y + dy }))
    .filter((candidate) => {
      if (!roomRect) return true;
      const margin = 10;
      return (
        candidate.x - halfW >= roomRect.left + margin &&
        candidate.x + halfW <= roomRect.right - margin &&
        candidate.y - blockHeight / 2 >= roomRect.top + margin &&
        candidate.y + blockHeight / 2 <= roomRect.bottom - margin
      );
    });
  const pick = candidates.find(
    (candidate) =>
      !clashesLabelBlock(
        candidate.x,
        candidate.y,
        blockHeight,
        avoid,
        [],
        nameLineHeight,
        halfW,
      ),
  ) || candidates.reduce<{ x: number; y: number } | null>((best, candidate) => {
    if (!best) return candidate;
    return labelClearance(candidate.x, candidate.y, halfW, blockHeight / 2, avoid) >
      labelClearance(best.x, best.y, halfW, blockHeight / 2, avoid)
      ? candidate
      : best;
  }, null);
  if (!pick) return [];

  if (nameLines.length) {
    const top = pick.y - blockHeight / 2;
    return [
      {
        id: 'center-label',
        x: pick.x,
        nameLines,
        areaText,
        nameStartY: top + nameLineHeight * 0.82,
        areaY: top + nameLines.length * nameLineHeight + nameAreaGap + areaLineHeight * 0.82,
      },
    ];
  }

  return [
    {
      id: 'center-label',
      x: pick.x,
      nameLines: [],
      areaText,
      nameStartY: pick.y,
      areaY: pick.y + 4,
    },
  ];
}

type AvoidPoint = {
  x: number;
  y: number;
  radius?: number;
  halfWidth?: number;
  halfHeight?: number;
};

function labelClearance(
  x: number,
  y: number,
  halfWidth: number,
  halfHeight: number,
  avoid: AvoidPoint[],
) {
  if (!avoid.length) return Number.POSITIVE_INFINITY;
  return Math.min(...avoid.map((point) => {
    const pointHalfW = point.halfWidth ?? point.radius ?? 20;
    const pointHalfH = point.halfHeight ?? point.radius ?? 20;
    const gapX = Math.abs(point.x - x) - pointHalfW - halfWidth;
    const gapY = Math.abs(point.y - y) - pointHalfH - halfHeight;
    if (gapX > 0 && gapY > 0) return Math.hypot(gapX, gapY);
    return Math.max(gapX, gapY);
  }));
}

function labelBlockHeight(
  nameLines: string[],
  areaText: string | null,
  nameLineHeight: number,
  nameAreaGap: number,
  areaLineHeight: number,
) {
  const nameBlock = nameLines.length * nameLineHeight;
  const areaBlock = areaText ? nameAreaGap + areaLineHeight : 0;
  return nameBlock + areaBlock;
}

function clashesLabelBlock(
  x: number,
  y: number,
  blockHeight: number,
  avoid: AvoidPoint[],
  placed: SectionLabelLayout[],
  nameLineHeight: number,
  halfW = 72,
) {
  const top = y - blockHeight / 2;
  const bottom = y + blockHeight / 2;
  if (top < 12 || bottom > 4096) return true;

  for (const point of avoid) {
    const pointHalfW = point.halfWidth ?? point.radius ?? 28;
    const pointHalfH = point.halfHeight ?? point.radius ?? 28;
    if (
      Math.abs(point.x - x) < pointHalfW + halfW + 6 &&
      Math.abs(point.y - y) < pointHalfH + blockHeight / 2 + 6
    ) return true;
  }

  return placed.some((existing) => {
    const dist = Math.hypot(existing.x - x, existing.y - y);
    return dist < Math.max(48, nameLineHeight * 2.2);
  });
}

export function layoutArchitecturalSectionLabels(
  sections: MappedSection[],
  avoid: AvoidPoint[],
  opts?: {
    nameFontSize?: number;
    nameLineHeight?: number;
    nameAreaGap?: number;
    areaFontSize?: number;
    areaLineHeight?: number;
  },
): SectionLabelLayout[] {
  const nameFontSize = opts?.nameFontSize ?? 15;
  const nameLineHeight = opts?.nameLineHeight ?? 16;
  const nameAreaGap = opts?.nameAreaGap ?? 5;
  const areaFontSize = opts?.areaFontSize ?? 11;
  const areaLineHeight = opts?.areaLineHeight ?? 13;
  const placed: SectionLabelLayout[] = [];

  for (const section of sections) {
    const nameLines = wrapLabelLines(section.label);
    const areaText =
      typeof section.areaSqM === 'number' && section.areaSqM > 0
        ? `${section.areaSqM.toFixed(2)} m²`
        : null;
    const blockHeight = labelBlockHeight(nameLines, areaText, nameLineHeight, nameAreaGap, areaLineHeight);
    const halfW = Math.max(
      34,
      Math.max(0, ...nameLines.map((line) => line.length * nameFontSize * 0.48)) / 2,
      ((areaText?.length || 0) * areaFontSize * 0.56) / 2,
    ) + 4;
    const candidates = [
      { x: section.x, y: section.y },
      { x: section.x, y: section.y - 22 },
      { x: section.x, y: section.y + 22 },
      { x: section.x - 34, y: section.y },
      { x: section.x + 34, y: section.y },
      { x: section.x - 34, y: section.y - 22 },
      { x: section.x + 34, y: section.y - 22 },
      { x: section.x - 34, y: section.y + 22 },
      { x: section.x + 34, y: section.y + 22 },
    ];
    const pick = candidates.find((candidate) => !clashesLabelBlock(
      candidate.x,
      candidate.y,
      blockHeight,
      avoid,
      placed,
      nameLineHeight,
      halfW,
    )) || candidates.reduce((best, candidate) =>
      labelClearance(candidate.x, candidate.y, halfW, blockHeight / 2, avoid) >
      labelClearance(best.x, best.y, halfW, blockHeight / 2, avoid)
        ? candidate
        : best,
    );
    if (!pick) continue;

    const top = pick.y - blockHeight / 2;
    const nameStartY = top + nameLineHeight * 0.82;
    const areaY = top + nameLines.length * nameLineHeight + nameAreaGap + areaLineHeight * 0.82;

    placed.push({
      id: section.id,
      x: pick.x,
      nameLines,
      areaText,
      nameStartY,
      areaY,
    });
  }

  return placed;
}

export function buildDoorSwingPath(
  opening: MappedOpening,
  roomCenter: { x: number; y: number },
): string | null {
  const hinge = opening.a;
  const leaf = opening.b;
  const dx = leaf.x - hinge.x;
  const dy = leaf.y - hinge.y;
  const radius = Math.hypot(dx, dy);
  if (radius < 6) return null;

  const mx = (hinge.x + leaf.x) / 2;
  const my = (hinge.y + leaf.y) / 2;
  const nx = -dy / radius;
  const ny = dx / radius;
  const towardCenter = (roomCenter.x - mx) * nx + (roomCenter.y - my) * ny;
  const sweep = towardCenter >= 0 ? 1 : 0;
  const endX = hinge.x + nx * radius * (towardCenter >= 0 ? 1 : -1);
  const endY = hinge.y + ny * radius * (towardCenter >= 0 ? 1 : -1);

  return `M ${leaf.x.toFixed(1)} ${leaf.y.toFixed(1)} A ${radius.toFixed(1)} ${radius.toFixed(1)} 0 0 ${sweep} ${endX.toFixed(1)} ${endY.toFixed(1)}`;
}

export function architecturalAvoidPoints(
  objects: MappedObject[],
  dimensionPoints: { x: number; y: number }[],
): AvoidPoint[] {
  return [
    ...objects.map((obj) => {
      const quarterTurn = Math.abs((obj.rotationDeg || 0) % 180) > 45;
      return {
        x: obj.x,
        y: obj.y,
        halfWidth: (quarterTurn ? obj.depthPx : obj.widthPx) / 2 + 8,
        halfHeight: (quarterTurn ? obj.widthPx : obj.depthPx) / 2 + 8,
      };
    }),
    ...dimensionPoints.map((point) => ({ x: point.x, y: point.y, radius: 22 })),
  ];
}

type PlanSide = 'top' | 'bottom' | 'left' | 'right';

function sideOfChain(chain: DimensionChain, center: { x: number; y: number }): PlanSide | null {
  const dx = Math.abs(chain.overall.b.x - chain.overall.a.x);
  const dy = Math.abs(chain.overall.b.y - chain.overall.a.y);
  const midX = (chain.overall.a.x + chain.overall.b.x) / 2;
  const midY = (chain.overall.a.y + chain.overall.b.y) / 2;
  if (dx > dy * 1.25) return midY < center.y ? 'top' : 'bottom';
  if (dy > dx * 1.25) return midX < center.x ? 'left' : 'right';
  return null;
}

function chainPriority(chain: DimensionChain) {
  return chain.segments.length * 1000 + Math.hypot(
    chain.overall.b.x - chain.overall.a.x,
    chain.overall.b.y - chain.overall.a.y,
  );
}

function dedupeDimensionChainsBySide(
  chains: DimensionChain[],
  center: { x: number; y: number },
): DimensionChain[] {
  const best = new Map<PlanSide, DimensionChain>();
  const diagonals: DimensionChain[] = [];
  for (const chain of chains) {
    const side = sideOfChain(chain, center);
    if (!side) {
      diagonals.push(chain);
      continue;
    }
    const existing = best.get(side);
    if (!existing || chainPriority(chain) > chainPriority(existing)) {
      best.set(side, chain);
    }
  }
  const cardinal = ['top', 'bottom', 'left', 'right']
    .map((side) => best.get(side as PlanSide))
    .filter((chain): chain is DimensionChain => Boolean(chain));
  return [...cardinal, ...diagonals.sort((a, b) => chainPriority(b) - chainPriority(a))];
}

function segmentLengthMeters(
  a: { x: number; y: number },
  b: { x: number; y: number },
  viewport: FloorPlanViewport,
): number {
  return Math.hypot(b.x - a.x, b.y - a.y) / viewport.scale;
}

/** Etykiety w cm liczone wprost z długości linii na planie — 1:1 z geometrią. */
export function syncChainLabelsFromGeometry(
  chains: DimensionChain[],
  viewport: FloorPlanViewport,
): DimensionChain[] {
  return chains.map((chain) => ({
    ...chain,
    overall: {
      ...chain.overall,
      label: formatArchitecturalDimensionCm(
        segmentLengthMeters(chain.overall.a, chain.overall.b, viewport),
      ),
    },
    segments: chain.segments.map((segment) => ({
      ...segment,
      label: formatArchitecturalDimensionCm(
        segmentLengthMeters(segment.a, segment.b, viewport),
      ),
    })),
  }));
}

function isPerimeterWall(
  wall: RoomScanWallSegment,
  bounds: FloorPlanScanMeta['bounds'],
): boolean {
  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;
  const eps = Math.max(0.16, Math.min(spanX, spanZ) * 0.045);
  const near = (a: number, b: number) => Math.abs(a - b) <= eps;
  const pointOnBoundary = (x: number, z: number) =>
    near(x, bounds.minX) ||
    near(x, bounds.maxX) ||
    near(z, bounds.minZ) ||
    near(z, bounds.maxZ);
  const onMinX = near(wall.x1, bounds.minX) && near(wall.x2, bounds.minX);
  const onMaxX = near(wall.x1, bounds.maxX) && near(wall.x2, bounds.maxX);
  const onMinZ = near(wall.z1, bounds.minZ) && near(wall.z2, bounds.minZ);
  const onMaxZ = near(wall.z1, bounds.maxZ) && near(wall.z2, bounds.maxZ);
  const connectsBoundaryEdges =
    pointOnBoundary(wall.x1, wall.z1) && pointOnBoundary(wall.x2, wall.z2);
  return onMinX || onMaxX || onMinZ || onMaxZ || connectsBoundaryEdges;
}

export function prepareArchitecturalDimensionChains(
  walls: RoomScanWallSegment[],
  openings: RoomScanOpening[],
  bounds: FloorPlanScanMeta['bounds'],
  viewport: FloorPlanViewport,
): DimensionChain[] {
  const perimeter = cleanWallsForPlan(walls).filter((wall) => isPerimeterWall(wall, bounds));
  const dimensionWalls = perimeter.length >= 3 ? perimeter : cleanWallsForPlan(walls);
  const dimensionOffset = Math.max(18, Math.min(60, viewport.padding * 0.42));
  const raw = buildWallDimensionChains(
    dimensionWalls,
    openings,
    bounds,
    viewport,
    formatArchitecturalDimensionCm,
    { inner: dimensionOffset, outer: dimensionOffset },
  );
  const center = mapFloorPlanPoint(
    (bounds.minX + bounds.maxX) / 2,
    (bounds.minZ + bounds.maxZ) / 2,
    bounds,
    viewport,
  );
  return syncChainLabelsFromGeometry(dedupeDimensionChainsBySide(raw, center), viewport);
}
