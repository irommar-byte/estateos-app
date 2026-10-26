import assert from 'node:assert/strict';
import test from 'node:test';
import type { FloorPlanScanMeta, RoomScanWallSegment } from '../../src/types/roomScan';
import {
  anchorSectionsToRooms,
  dimensionSegmentsForRender,
  orthogonalizeScanPlan,
  prepareArchitecturalDimensionChains,
  sealPlanJunctions,
} from '../../src/lib/roomScan/floorPlanArchitectural';
import { buildFloorPlanViewport, mapFloorPlanPoint } from '../../src/lib/roomScan/floorPlanGeometry';

function rotate(x: number, z: number, degrees: number) {
  const angle = (degrees * Math.PI) / 180;
  return {
    x: x * Math.cos(angle) - z * Math.sin(angle),
    z: x * Math.sin(angle) + z * Math.cos(angle),
  };
}

function fixture() {
  const width = 4.94;
  const height = 3.66;
  const angle = 17;
  const corners = [
    rotate(-width / 2, -height / 2, angle),
    rotate(width / 2, -height / 2, angle),
    rotate(width / 2, height / 2, angle),
    rotate(-width / 2, height / 2, angle),
  ];
  const walls: RoomScanWallSegment[] = [
    { x1: corners[0].x, z1: corners[0].z, x2: corners[1].x, z2: corners[1].z },
    { x1: corners[1].x, z1: corners[1].z, x2: corners[2].x, z2: corners[2].z },
    // Krótszy, zaszumiony dół z RoomPlan — kanoniczny obrys ma go domknąć.
    {
      x1: corners[2].x,
      z1: corners[2].z,
      x2: corners[3].x + 0.48 * Math.cos((angle * Math.PI) / 180),
      z2: corners[3].z + 0.48 * Math.sin((angle * Math.PI) / 180),
    },
    { x1: corners[3].x, z1: corners[3].z, x2: corners[0].x, z2: corners[0].z },
  ];
  const doorA = rotate(-width / 2, 0.32, angle);
  const doorB = rotate(-width / 2, 1.17, angle);
  const allPoints = corners;
  const meta: FloorPlanScanMeta = {
    version: 2,
    scannedAt: '2026-09-01T08:00:00.000Z',
    roomCount: 1,
    totalAreaSqM: 18.1,
    ceilingHeightM: 2.97,
    sections: [
      {
        key: 'bedroom',
        label: 'Sypialnia',
        centerX: 0,
        centerZ: 0,
        widthM: height,
        lengthM: width,
        areaSqM: 18.1,
      },
    ],
    walls,
    objects: [],
    openings: [
      {
        id: 'door-1',
        kind: 'door',
        x1: doorA.x,
        z1: doorA.z,
        x2: doorB.x,
        z2: doorB.z,
      },
    ],
    bounds: {
      minX: Math.min(...allPoints.map((point) => point.x)),
      maxX: Math.max(...allPoints.map((point) => point.x)),
      minZ: Math.min(...allPoints.map((point) => point.z)),
      maxZ: Math.max(...allPoints.map((point) => point.z)),
    },
    northRotationDegrees: 180,
  };
  return { walls, meta, width, height };
}

test('prostuje pojedynczy pokój do jednego domkniętego obrysu', () => {
  const source = fixture();
  const result = orthogonalizeScanPlan(source.walls, source.meta);
  const spanX = result.meta.bounds.maxX - result.meta.bounds.minX;
  const spanZ = result.meta.bounds.maxZ - result.meta.bounds.minZ;

  assert.equal(result.walls.length, 4);
  assert.ok(Math.abs(spanX - source.width) < 0.001);
  assert.ok(Math.abs(spanZ - source.height) < 0.001);
  assert.equal(Math.round(result.walls[0].lengthM! * 100), 494);
  assert.equal(Math.round(result.walls[2].lengthM! * 100), 494);
  assert.equal(Math.round(result.walls[1].lengthM! * 100), 366);
  assert.equal(Math.round(result.walls[3].lengthM! * 100), 366);
});

test('umieszcza wymiary poza ścianami i utrzymuje wspólny wymiar przeciwległych boków', () => {
  const source = fixture();
  const result = orthogonalizeScanPlan(source.walls, source.meta);
  const viewport = buildFloorPlanViewport(result.meta.bounds, 520, 478, 115);
  const center = mapFloorPlanPoint(0, 0, result.meta.bounds, viewport);
  const chains = prepareArchitecturalDimensionChains(
    result.walls,
    result.meta.openings,
    result.meta.bounds,
    viewport,
  );
  const planLeft = viewport.offsetX;
  const planRight = viewport.offsetX + (result.meta.bounds.maxX - result.meta.bounds.minX) * viewport.scale;
  const planTop = viewport.offsetY;
  const planBottom = viewport.offsetY + (result.meta.bounds.maxZ - result.meta.bounds.minZ) * viewport.scale;

  assert.equal(chains.length, 4);
  const bySide = new Map(
    chains.map((chain) => {
      const midX = (chain.overall.a.x + chain.overall.b.x) / 2;
      const midY = (chain.overall.a.y + chain.overall.b.y) / 2;
      const horizontal = Math.abs(chain.overall.b.x - chain.overall.a.x) >
        Math.abs(chain.overall.b.y - chain.overall.a.y);
      const side = horizontal
        ? midY < center.y ? 'top' : 'bottom'
        : midX < center.x ? 'left' : 'right';
      return [side, chain] as const;
    }),
  );

  assert.equal(bySide.get('top')?.overall.label, '494');
  assert.equal(bySide.get('bottom')?.overall.label, '494');
  assert.equal(bySide.get('right')?.overall.label, '366');
  assert.ok(bySide.get('top')!.overall.a.y < planTop);
  assert.ok(bySide.get('bottom')!.overall.a.y > planBottom);
  assert.ok(bySide.get('left')!.overall.a.x < planLeft);
  assert.ok(bySide.get('right')!.overall.a.x > planRight);

  const leftSegments = dimensionSegmentsForRender(bySide.get('left')!);
  assert.ok(leftSegments.length >= 3);
  assert.equal(
    leftSegments.reduce((sum, segment) => sum + Number(segment.label), 0),
    366,
  );
});

test('domyka styki ścian dwóch pomieszczeń i rozsuwa podpisy', () => {
  const gap = 0.14;
  const walls: RoomScanWallSegment[] = [
    { x1: 0, z1: 0, x2: 4 - gap, z2: 0 },
    { x1: 4, z1: gap, x2: 4, z2: 3 - gap },
    { x1: 4 - gap, z1: 3, x2: gap, z2: 3 },
    { x1: 0, z1: 3 - gap, x2: 0, z2: gap },
    { x1: 4 + gap, z1: 0, x2: 7, z2: 0 },
    { x1: 7, z1: gap, x2: 7, z2: 3 - gap },
    { x1: 7 - gap, z1: 3, x2: 4 + gap, z2: 3 },
    { x1: 4, z1: gap, x2: 4, z2: 3 - gap },
  ];
  const sealed = sealPlanJunctions(walls);
  const xs = sealed.flatMap((wall) => [wall.x1, wall.x2]);
  const zs = sealed.flatMap((wall) => [wall.z1, wall.z2]);
  assert.ok(Math.min(...xs) < 0.05);
  assert.ok(Math.max(...xs) > 6.9);
  assert.ok(sealed.some((wall) => Math.abs(wall.x1 - 4) < 0.05 || Math.abs(wall.x2 - 4) < 0.05));
  assert.ok(Math.min(...zs) < 0.05 && Math.max(...zs) > 2.9);

  const bounds = {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
  const anchored = anchorSectionsToRooms(
    [
      { key: 'livingRoom', label: 'Salon', centerX: 0.2, centerZ: 0.2, areaSqM: 20 },
      { key: 'bedroom', label: 'Sypialnia', centerX: 0.4, centerZ: 0.3, areaSqM: 11 },
    ],
    sealed,
    bounds,
  );
  const dist = Math.hypot(
    anchored[0].centerX - anchored[1].centerX,
    anchored[0].centerZ - anchored[1].centerZ,
  );
  assert.ok(dist > 1.2);
});
