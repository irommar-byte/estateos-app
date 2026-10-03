import assert from 'node:assert/strict';
import test from 'node:test';
import { dedupeScheduleEvents, isSameWarsawDay } from '../../src/lib/crm/scheduleIdentity';

test('buyer and seller copies of one showing collapse to the buyer', () => {
  const startsAt = '2026-10-04T09:00:00.000Z';
  const items = dedupeScheduleEvents([
    {
      id: 'presentation-200-seller',
      kind: 'presentation',
      startsAt,
      offerId: 1228,
      clientId: 200,
      buyerClientId: 112,
      role: 'SELLER' as const,
    },
    {
      id: 'presentation-112-buyer',
      kind: 'presentation',
      startsAt,
      offerId: 1228,
      clientId: 112,
      buyerClientId: 112,
      role: 'BUYER' as const,
    },
    {
      id: 'appt-9',
      kind: 'presentation',
      startsAt,
      offerId: 1228,
      clientId: null,
      role: null,
    },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].clientId, 112);
});

test('two different showings on the same day both stay', () => {
  const items = dedupeScheduleEvents([
    {
      id: 'a',
      kind: 'presentation',
      startsAt: '2026-10-04T09:00:00.000Z',
      offerId: 1,
      clientId: 10,
      buyerClientId: 10,
      role: 'BUYER' as const,
    },
    {
      id: 'b',
      kind: 'presentation',
      startsAt: '2026-10-04T12:00:00.000Z',
      offerId: 2,
      clientId: 11,
      buyerClientId: 11,
      role: 'BUYER' as const,
    },
  ]);
  assert.equal(items.length, 2);
});

test('tomorrow in Warsaw is not today', () => {
  const now = new Date('2026-10-03T13:58:00.000Z');
  assert.equal(isSameWarsawDay('2026-10-04T09:00:00.000Z', now), false);
  assert.equal(isSameWarsawDay('2026-10-03T09:00:00.000Z', now), true);
});
