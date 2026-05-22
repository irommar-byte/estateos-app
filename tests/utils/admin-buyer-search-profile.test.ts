import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBuyerIntentSummary,
  extractSearchSnapshotsFromUser,
  radarPreferenceDetailRows,
} from '../../src/utils/adminBuyerSearchProfile';
import { hasMeaningfulRadarFields } from '../../src/services/adminUserRadarService';

describe('adminBuyerSearchProfile', () => {
  it('extracts active radar preference and history', () => {
    const snapshots = extractSearchSnapshotsFromUser({
      radarPreference: {
        transactionType: 'SELL',
        city: 'Warszawa',
        selectedDistricts: ['Mokotów'],
        propertyType: 'FLAT',
        maxPrice: 1_200_000,
        minArea: 45,
        minMatchThreshold: 78,
        pushNotifications: true,
      },
      radarSearchHistory: [
        {
          savedAt: '2026-05-01T10:00:00Z',
          filters: {
            transactionType: 'SELL',
            city: 'Kraków',
            maxPrice: 900_000,
            propertyType: 'FLAT',
          },
        },
      ],
    });
    assert.equal(snapshots.length, 2);
    assert.equal(snapshots[0].source, 'active');
    assert.equal(snapshots[1].source, 'history');
  });

  it('builds summary with confidence from snapshot count', () => {
    const snapshots = extractSearchSnapshotsFromUser({
      radarPreference: {
        transactionType: 'RENT',
        city: 'Gdańsk',
        propertyType: 'FLAT',
        maxPrice: 4000,
        pushNotifications: true,
        minMatchThreshold: 80,
      },
      radarSearchHistory: [
        { filters: { transactionType: 'RENT', city: 'Gdańsk', maxPrice: 4500, propertyType: 'FLAT' } },
        { filters: { transactionType: 'RENT', city: 'Gdańsk', maxPrice: 3800, propertyType: 'FLAT' } },
      ],
    });
    const summary = buildBuyerIntentSummary(snapshots);
    assert.ok(summary.probabilityPercent > 0);
    assert.equal(summary.historyEventCount, 2);
    assert.equal(summary.dominantTransaction, 'RENT');
    assert.ok(summary.headline.includes('Gdańsk'));
    assert.ok(summary.bullets.some((b) => b.includes('Radar')));
  });

  it('returns empty-state summary when no data', () => {
    const summary = buildBuyerIntentSummary([]);
    assert.equal(summary.snapshotCount, 0);
    assert.equal(summary.confidence, 'low');
    assert.ok(summary.headline.includes('Brak'));
  });

  it('recognizes backend districts column as meaningful', () => {
    assert.equal(
      hasMeaningfulRadarFields({
        pushNotifications: true,
        city: 'Warszawa',
        districts: ['Mokotów'],
        minYear: 2010,
      }),
      true,
    );
  });

  it('maps radar preference to detail rows', () => {
    const rows = radarPreferenceDetailRows({
      pushNotifications: true,
      transactionType: 'SELL',
      city: 'Wrocław',
      minMatchThreshold: 85,
      requireBalcony: true,
    });
    assert.ok(rows.some((r) => r.label === 'Radar / push' && r.value === 'Włączony'));
    assert.ok(rows.some((r) => r.label === 'Wymagania' && r.value.includes('balkon')));
  });
});
