import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  advancedPriceBoundsToPln,
  plnFromListingAmount,
  convertBetweenCurrencies,
} from '../../src/money/convert';

describe('money convert', () => {
  it('converts EUR to PLN', () => {
    assert.equal(plnFromListingAmount(100_000, 'EUR', 4.3), 430_000);
  });

  it('converts PLN to EUR when switching currency in form', () => {
    assert.equal(convertBetweenCurrencies(430_000, 'PLN', 'EUR', 4.3), 100_000);
  });

  it('converts advanced search EUR bounds to PLN', () => {
    const b = advancedPriceBoundsToPln(100_000, 200_000, 'EUR', 4.3);
    assert.equal(b.minPln, 430_000);
    assert.equal(b.maxPln, 860_000);
  });
});
