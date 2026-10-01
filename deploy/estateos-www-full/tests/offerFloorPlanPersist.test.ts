import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveFloorPlanAssetPatch,
  wouldDestroyScanGeometry,
} from '../src/lib/offerFloorPlanPersist';

const richMeta = JSON.stringify({
  version: 2,
  walls: [{ x1: 0, z1: 0, x2: 1, z2: 0 }],
  roomScans: [{ id: 'room-1', name: 'Salon', areaM2: '20.2' }],
});

test('null floorPlanScanMeta without clear flag is ignored', () => {
  const patch = resolveFloorPlanAssetPatch(
    { title: 'Nowy tytuł', floorPlanScanMeta: null },
    { floorPlanScanMeta: richMeta, floorPlan3dUrl: '/uploads/x.usdz' },
  );
  assert.equal(patch.floorPlanScanMeta, undefined);
  assert.equal(patch.floorPlan3dUrl, undefined);
});

test('explicit clearFloorPlan allows wiping meta and 3d', () => {
  const patch = resolveFloorPlanAssetPatch(
    {
      clearFloorPlan: true,
      floorPlanScanMeta: null,
      floorPlan3dUrl: null,
      floorPlanUrl: null,
    },
    { floorPlanScanMeta: richMeta, floorPlan3dUrl: '/uploads/x.usdz', floorPlanUrl: '/uploads/p.png' },
  );
  assert.equal(patch.floorPlanScanMeta, null);
  assert.equal(patch.floorPlan3dUrl, null);
  assert.equal(patch.floorPlanUrl, null);
});

test('clearFloorPlan3d drops only the model', () => {
  const patch = resolveFloorPlanAssetPatch(
    { clearFloorPlan3d: true, floorPlan3dUrl: null },
    { floorPlanScanMeta: richMeta, floorPlan3dUrl: '/uploads/x.usdz' },
  );
  assert.equal(patch.floorPlan3dUrl, null);
  assert.equal(patch.floorPlanScanMeta, undefined);
});

test('title-only body does not touch floor plan fields', () => {
  const patch = resolveFloorPlanAssetPatch(
    { title: 'Tylko tytuł', description: 'Nowy opis' },
    { floorPlanScanMeta: richMeta, floorPlan3dUrl: '/uploads/x.usdz' },
  );
  assert.deepEqual(patch, {});
});

test('wouldDestroyScanGeometry detects wall/room loss', () => {
  assert.equal(wouldDestroyScanGeometry(richMeta, JSON.stringify({ walls: [], roomScans: [] })), true);
  assert.equal(
    wouldDestroyScanGeometry(
      richMeta,
      JSON.stringify({
        walls: [{ x1: 0, z1: 0, x2: 2, z2: 0 }],
        roomScans: [{ id: 'room-1', name: 'Salon', areaM2: '20.2' }],
      }),
    ),
    false,
  );
});

test('destructive meta replace without flag is ignored', () => {
  const patch = resolveFloorPlanAssetPatch(
    { floorPlanScanMeta: JSON.stringify({ walls: [], roomScans: [] }) },
    { floorPlanScanMeta: richMeta },
  );
  assert.equal(patch.floorPlanScanMeta, undefined);
});

test('replaceFloorPlanScanMeta allows intentional overwrite', () => {
  const next = JSON.stringify({ walls: [], roomScans: [] });
  const patch = resolveFloorPlanAssetPatch(
    { floorPlanScanMeta: next, replaceFloorPlanScanMeta: true },
    { floorPlanScanMeta: richMeta },
  );
  assert.equal(patch.floorPlanScanMeta, next);
});
