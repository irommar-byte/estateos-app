import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { measurementsFromScanMeta } from '../../src/lib/roomScan/roomScanMeasurements';
import type { FloorPlanScanMeta } from '../../src/types/roomScan';

describe('room scan measurements', () => {
  it('fills width length height and area from walls when section is missing', () => {
    const meta: FloorPlanScanMeta = {
      version: 2,
      scannedAt: '2026-08-18T00:00:00.000Z',
      roomCount: 1,
      totalAreaSqM: 12.6,
      ceilingHeightM: 2.62,
      sections: [],
      walls: [
        { x1: 0, z1: 0, x2: 4.2, z2: 0, lengthM: 4.2, heightM: 2.62 },
        { x1: 4.2, z1: 0, x2: 4.2, z2: 3, lengthM: 3, heightM: 2.62 },
        { x1: 4.2, z1: 3, x2: 0, z2: 3, lengthM: 4.2, heightM: 2.62 },
        { x1: 0, z1: 3, x2: 0, z2: 0, lengthM: 3, heightM: 2.62 },
      ],
      objects: [],
      openings: [],
      bounds: { minX: -1, maxX: 5, minZ: -1, maxZ: 4 },
    };
    const measured = measurementsFromScanMeta(meta);
    assert.equal(measured.widthM, '3.00');
    assert.equal(measured.lengthM, '4.20');
    assert.equal(measured.heightM, '2.62');
    assert.equal(measured.areaM2, '12.6');
  });
});
