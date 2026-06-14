import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAmountWithCurrency,
  formatMarkerPriceCompact,
  formatOfferPriceDisplay,
  resolveOfferDisplayAmount,
} from '../../src/money/format';

describe('money format', () => {
  it('uses euro sign for EUR amounts', () => {
    assert.match(formatAmountWithCurrency(150_000, 'EUR'), /150.*000 €/);
  });

  it('uses zł suffix for PLN amounts', () => {
    assert.match(formatAmountWithCurrency(638_190, 'PLN'), /638.*190 zł/);
  });

  it('marker compact is ultra-short for map pins', () => {
    assert.equal(formatMarkerPriceCompact(150_000, 'EUR'), '150k');
    assert.equal(formatMarkerPriceCompact(638_190, 'PLN'), '638k');
    assert.equal(formatMarkerPriceCompact(1_300_000, 'PLN'), '1.3M');
  });

  it('LISTING preference shows offer currency', () => {
    const d = resolveOfferDisplayAmount({
      amount: 150_000,
      listingCurrency: 'EUR',
      pricePln: 646_845,
      displayPreference: 'LISTING',
      rate: 4.3123,
    });
    assert.equal(d.displayCurrency, 'EUR');
    assert.equal(d.displayAmount, 150_000);
  });

  it('PLN preference converts EUR listing for display', () => {
    const d = resolveOfferDisplayAmount({
      amount: 150_000,
      listingCurrency: 'EUR',
      pricePln: 646_845,
      displayPreference: 'PLN',
      rate: 4.3123,
    });
    assert.equal(d.displayCurrency, 'PLN');
    assert.equal(d.displayAmount, 646_845);
  });

  it('EUR preference shows EUR for EUR listing', () => {
    const fmt = formatOfferPriceDisplay({
      amount: 150_000,
      listingCurrency: 'EUR',
      pricePln: 646_845,
      displayPreference: 'EUR',
      rate: 4.3123,
    });
    assert.match(fmt.primary, /150.*000 €/);
    assert.equal(fmt.secondary?.includes('W ofercie'), false);
  });
});
