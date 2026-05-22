import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isFavoriteId, normalizeFavoriteIds } from '../../src/utils/favoritesStorage';

describe('favoritesStorage', () => {
  it('normalizes string and number ids', () => {
    assert.deepEqual(normalizeFavoriteIds([187, '188', 'x', 187]), [187, 188]);
  });

  it('matches favorite regardless of stored type', () => {
    const ids = normalizeFavoriteIds(['187']);
    assert.equal(isFavoriteId(187, ids), true);
    assert.equal(isFavoriteId('187', ids), true);
  });
});
