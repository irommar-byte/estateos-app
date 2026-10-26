import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFloorPlanScanMeta } from '../../src/lib/roomScan/parseRoomPlanJson';
import {
  cropScanMetaToRoom,
  roomsFromScanMeta,
} from '../../src/lib/roomScan/refineScanSections';

function wall(cx: number, cz: number, length: number, vertical = false) {
  return {
    dimensions: [length, 2.7, 0],
    transform: vertical
      ? [0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, cx, 0, cz, 1]
      : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, cx, 0, cz, 1],
    category: { wall: {} },
  };
}

function rectangleWalls(cx: number, cz: number, width: number, length: number) {
  return [
    wall(cx, cz - length / 2, width),
    wall(cx, cz + length / 2, width),
    wall(cx - width / 2, cz, length, true),
    wall(cx + width / 2, cz, length, true),
  ];
}

function room(
  cx: number,
  cz: number,
  width: number,
  length: number,
  label: string,
) {
  return {
    walls: rectangleWalls(cx, cz, width, length),
    floors: [
      {
        identifier: `floor-${cx}-${cz}`,
        dimensions: [width, length, 0],
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, cx, 0, cz, 1],
        category: { floor: {} },
      },
    ],
    sections: [{ label: { [label]: {} }, center: [cx, 0, cz], story: 0 }],
    objects: [],
  };
}

test('uses RoomPlan floor surfaces instead of the whole-apartment bounding box', () => {
  const meta = buildFloorPlanScanMeta({
    rooms: [
      room(0, 0, 5, 4, 'livingRoom'),
      room(6, 0, 4, 5, 'bedroom'),
      room(0, 5.5, 5, 3, 'kitchen'),
    ],
  });

  assert.equal(meta.totalAreaSqM, 55);
  assert.deepEqual(
    meta.sections.map((section) => section.areaSqM).sort((a, b) => Number(a) - Number(b)),
    [15, 20, 20],
  );
  assert.ok(meta.sections.every((section) => section.areaSource === 'floor'));
});

test('uses an irregular floor polygon when RoomPlan provides polygon corners', () => {
  const meta = buildFloorPlanScanMeta({
    rooms: [
      {
        walls: rectangleWalls(0, 0, 6, 6),
        floors: [
          {
            identifier: 'polygon-floor',
            polygonCorners: [
              [0, 0, 0],
              [4, 0, 0],
              [4, 3, 0],
              [0, 3, 0],
            ],
            transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
            category: { floor: {} },
          },
        ],
        sections: [{ label: { livingRoom: {} }, center: [0, 0, 0], story: 0 }],
      },
    ],
  });

  assert.equal(meta.totalAreaSqM, 12);
  assert.equal(meta.sections[0]?.areaSqM, 12);
  assert.equal(meta.sections[0]?.floorPolygon?.length, 4);
});

test('creates a closed room preview and excludes furniture from neighboring rooms', () => {
  const meta = buildFloorPlanScanMeta({
    rooms: [
      room(0, 0, 5, 4, 'kitchen'),
      room(6, 0, 4, 5, 'livingRoom'),
    ],
  });
  meta.objects = [
    {
      id: 'kitchen-table',
      category: 'table',
      label: 'Stół',
      centerX: 0,
      centerZ: 0,
      widthM: 1.2,
      depthM: 0.8,
    },
    {
      id: 'living-room-sofa',
      category: 'sofa',
      label: 'Sofa',
      centerX: 6,
      centerZ: 0,
      widthM: 2,
      depthM: 0.9,
    },
  ];
  const kitchen = roomsFromScanMeta(meta)[0];
  const preview = cropScanMetaToRoom(meta, kitchen);

  assert.ok(preview);
  assert.equal(preview.walls.length, 4);
  assert.deepEqual(preview.objects.map((object) => object.id), ['kitchen-table']);
  for (let index = 0; index < preview.walls.length; index += 1) {
    const current = preview.walls[index];
    const next = preview.walls[(index + 1) % preview.walls.length];
    assert.ok(Math.hypot(current.x2 - next.x1, current.z2 - next.z1) < 0.01);
  }
});
