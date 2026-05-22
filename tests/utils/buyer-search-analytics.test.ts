import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeBuyerSearchAnalytics } from '../../src/utils/buyerSearchAnalytics';
import type { BuyerSearchSnapshot } from '../../src/utils/adminBuyerSearchProfile';

function snap(
  partial: Partial<BuyerSearchSnapshot> & { params: BuyerSearchSnapshot['params'] },
): BuyerSearchSnapshot {
  return {
    id: '1',
    savedAtIso: '2026-05-01T10:00:00Z',
    source: 'history',
    title: 'Warszawa',
    subtitle: 'test',
    raw: {},
    ...partial,
  };
}

describe('buyerSearchAnalytics', () => {
  it('groups duplicate search patterns and counts frequency', () => {
    const base = {
      transactionType: 'SELL',
      city: 'Kraków',
      propertyType: 'FLAT',
      maxPrice: 800000,
      minArea: 0,
      minYear: 0,
      minMatchThreshold: 70,
      pushNotifications: false,
    };
    const snapshots = [
      snap({ params: base }),
      snap({ params: base }),
      snap({ params: { ...base, city: 'Gdańsk' } }),
    ];
    const a = computeBuyerSearchAnalytics(snapshots);
    assert.equal(a.historyEvents, 3);
    assert.equal(a.patternGroups[0].count, 2);
    assert.equal(a.patternGroups[0].sharePercent, 67);
    assert.ok(a.probabilityPercent > 30);
  });
});
