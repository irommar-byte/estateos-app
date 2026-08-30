import assert from 'node:assert/strict';
import test from 'node:test';
import {
  listingRoomCountFromKeys,
  refineScanSections,
  totalUniqueAreaSqM,
  uniqueRoomsByFootprint,
} from '../../src/lib/roomScan/refineScanSections';
import type { RoomScanSection, RoomScanWallSegment } from '../../src/types/roomScan';

function rect(x: number, z: number, w: number, l: number): RoomScanWallSegment[] {
  return [
    { x1: x - w / 2, z1: z - l / 2, x2: x + w / 2, z2: z - l / 2, lengthM: w, heightM: 2.63 },
    { x1: x + w / 2, z1: z - l / 2, x2: x + w / 2, z2: z + l / 2, lengthM: l, heightM: 2.63 },
    { x1: x + w / 2, z1: z + l / 2, x2: x - w / 2, z2: z + l / 2, lengthM: w, heightM: 2.63 },
    { x1: x - w / 2, z1: z + l / 2, x2: x - w / 2, z2: z - l / 2, lengthM: l, heightM: 2.63 },
  ];
}

test('duplicate Apple rooms sharing one footprint do not triple the area', () => {
  const whole = rect(0, 0, 6.95, 7.27);
  const unique = uniqueRoomsByFootprint([
    { walls: whole, sections: [{ key: 'kitchen', label: 'Kuchnia', centerX: -1.8, centerZ: -1.4 }] },
    { walls: whole, sections: [{ key: 'bathroom', label: 'Łazienka', centerX: 1.9, centerZ: 2.1 }] },
    { walls: whole, sections: [{ key: 'bathroom', label: 'Łazienka', centerX: 2.0, centerZ: -1.8 }] },
  ]);
  assert.equal(unique.length, 1);
  assert.equal(unique[0].sections.length, 3);

  const objects = [
    { id: '1', category: 'stove' as const, label: 'Kuchenka', centerX: -1.8, centerZ: -1.4, widthM: 0.6, depthM: 0.6 },
    { id: '2', category: 'toilet' as const, label: 'WC', centerX: 1.9, centerZ: 2.1, widthM: 0.4, depthM: 0.5 },
    { id: '3', category: 'bed' as const, label: 'Łóżko', centerX: 2.0, centerZ: -1.8, widthM: 1.6, depthM: 2 },
  ];
  const refined = refineScanSections(unique[0].sections as RoomScanSection[], whole, objects, 2.63);
  const total = totalUniqueAreaSqM(refined, whole);
  assert.ok(total < 60, `total ${total} should be unique footprint not 82.8`);
  const areas = refined.map((s) => s.areaSqM);
  assert.equal(areas.length > 1 && areas.every((a) => a === areas[0]), false);
  assert.ok(refined.some((s) => s.key === 'bedroom' || s.key === 'room'));
});

test('listing room count skips kitchen bathroom hallway and storage', () => {
  assert.equal(listingRoomCountFromKeys(['livingRoom', 'kitchen', 'bathroom', 'hallway', 'bedroom']), 2);
  assert.equal(listingRoomCountFromKeys(['livingRoomKitchenette', 'wc', 'storageUnit', 'room']), 2);
});
