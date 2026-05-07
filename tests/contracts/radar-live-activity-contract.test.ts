import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRadarLiveActivitySnapshot,
  validateRadarLiveActivityPushPayload,
} from '../../src/contracts/radarLiveActivityContract';

test('buildRadarLiveActivitySnapshot normalizes and clamps values', () => {
  const snapshot = buildRadarLiveActivitySnapshot({
    enabled: true,
    transactionType: 'rent' as any,
    city: '  ',
    minMatchThreshold: 112,
    activeMatchesCount: -4,
  });

  assert.deepEqual(snapshot.enabled, true);
  assert.deepEqual(snapshot.transactionType, 'RENT');
  assert.deepEqual(snapshot.city, 'Warszawa');
  assert.deepEqual(snapshot.minMatchThreshold, 100);
  assert.deepEqual(snapshot.activeMatchesCount, 0);
  assert.ok(typeof snapshot.updatedAtIso === 'string' && snapshot.updatedAtIso.length > 8);
});

test('validateRadarLiveActivityPushPayload accepts canonical payload', () => {
  const payload = validateRadarLiveActivityPushPayload({
    type: 'RADAR_LIVE_ACTIVITY_UPDATE',
    radar: {
      enabled: true,
      transactionType: 'SELL',
      city: 'Krakow',
      minMatchThreshold: 75,
      activeMatchesCount: 16,
      updatedAtIso: '2026-05-07T10:00:00.000Z',
    },
  });

  assert.ok(payload);
  assert.deepEqual(payload?.radar.city, 'Krakow');
  assert.deepEqual(payload?.radar.minMatchThreshold, 75);
  assert.deepEqual(payload?.radar.activeMatchesCount, 16);
});

test('validateRadarLiveActivityPushPayload rejects unknown type', () => {
  const payload = validateRadarLiveActivityPushPayload({
    type: 'RADAR_UNKNOWN',
    radar: {},
  });
  assert.equal(payload, null);
});
