import test from 'node:test';
import assert from 'node:assert/strict';
import { indexActivities, indexMatchStats, num } from '../../src/lib/crm/clientListQuery';

test('match aggregation maps bigint counts', () => {
  const map = indexMatchStats([
    { clientId: 12, matchCount: 4n, topScore: 88, sentCount: 2n },
  ]);
  assert.deepEqual(map.get(12), { count: 4, top: 88, sent: 2 });
});

test('activity rows group by client', () => {
  const map = indexActivities([
    { clientId: 1, kind: 'ACQUISITION_MEETING', metadata: { startsAt: '2026-09-08' } },
    { clientId: 1, kind: 'PRESENTATION_CONFIRMED', metadata: {} },
  ]);
  assert.equal(map.get(1)?.length, 2);
  assert.equal(num('3'), 3);
});
