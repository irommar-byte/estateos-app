import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveRoomDimensionsFromWalls } from '../../src/lib/roomScan/roomScanMeasurements';
import type { RoomScanWallSegment } from '../../src/types/roomScan';

function rotatedRectangle(width: number, length: number, degrees: number): RoomScanWallSegment[] {
  const angle = (degrees * Math.PI) / 180;
  const rotate = (x: number, z: number) => ({
    x: x * Math.cos(angle) - z * Math.sin(angle),
    z: x * Math.sin(angle) + z * Math.cos(angle),
  });
  const corners = [
    rotate(-width / 2, -length / 2),
    rotate(width / 2, -length / 2),
    rotate(width / 2, length / 2),
    rotate(-width / 2, length / 2),
  ];
  return corners.map((point, index) => {
    const next = corners[(index + 1) % corners.length];
    return {
      x1: point.x,
      z1: point.z,
      x2: next.x,
      z2: next.z,
      lengthM: Math.hypot(next.x - point.x, next.z - point.z),
      heightM: 2.72,
    };
  });
}

test('LiDAR room dimensions follow wall axes for a rotated room', () => {
  const walls = rotatedRectangle(4.2, 5.6, 37);
  const dimensions = deriveRoomDimensionsFromWalls(walls);
  assert.ok(dimensions);
  assert.ok(Math.abs(dimensions.widthM - 4.2) < 0.02);
  assert.ok(Math.abs(dimensions.lengthM - 5.6) < 0.02);
});

test('LiDAR dimensions produce a stable area for a rotated rectangular room', () => {
  const walls = rotatedRectangle(4, 5, 52);
  const dimensions = deriveRoomDimensionsFromWalls(walls);
  assert.ok(dimensions);
  assert.ok(Math.abs(dimensions.widthM * dimensions.lengthM - 20) < 0.1);
});
