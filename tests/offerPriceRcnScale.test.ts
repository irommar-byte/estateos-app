import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cityFallbackVsMedianPct,
  marketStatusFromVsMedianPct,
} from '../src/lib/offerRcnMarketStatus';
import {
  buildOfferPriceRcnScale,
  formatRcnDeltaLabel,
} from '../src/lib/offerPriceRcnScale';

test('marketStatusFromVsMedianPct uses ±5% bands', () => {
  assert.equal(marketStatusFromVsMedianPct(-5), 'bargain');
  assert.equal(marketStatusFromVsMedianPct(-14.4), 'bargain');
  assert.equal(marketStatusFromVsMedianPct(-4.9), 'market');
  assert.equal(marketStatusFromVsMedianPct(0), 'market');
  assert.equal(marketStatusFromVsMedianPct(4.9), 'market');
  assert.equal(marketStatusFromVsMedianPct(5), 'luxury');
  assert.equal(marketStatusFromVsMedianPct(12), 'luxury');
});

test('cityFallbackVsMedianPct mirrors legacy city averages', () => {
  assert.equal(cityFallbackVsMedianPct({ pricePerSqm: 16500, city: 'Warszawa' }), 0);
  assert.ok((cityFallbackVsMedianPct({ pricePerSqm: 14000, city: 'Warszawa' }) ?? 0) < -5);
  assert.ok((cityFallbackVsMedianPct({ pricePerSqm: 18000, city: 'Warszawa' }) ?? 0) > 5);
});

test('buildOfferPriceRcnScale centers on recommended ask', () => {
  const mid = buildOfferPriceRcnScale({ listingPrice: 758000, recommendedAsk: 758000 });
  assert.equal(mid.ok, true);
  if (!mid.ok) return;
  assert.equal(mid.positionPct, 50);
  assert.equal(mid.tone, 'at');
  assert.equal(mid.clamped, false);
});

test('buildOfferPriceRcnScale maps −14.4% below recommendation', () => {
  const recommended = 758000;
  const listing = Math.round(recommended * (1 - 0.144));
  const model = buildOfferPriceRcnScale({ listingPrice: listing, recommendedAsk: recommended });
  assert.equal(model.ok, true);
  if (!model.ok) return;
  assert.equal(model.tone, 'below');
  assert.ok(model.positionPct < 50);
  assert.ok(model.positionPct > 20);
  assert.ok(Math.abs(model.deltaPct + 14.4) < 0.2);
});

test('buildOfferPriceRcnScale clamps beyond ±30%', () => {
  const low = buildOfferPriceRcnScale({ listingPrice: 400000, recommendedAsk: 800000 });
  assert.equal(low.ok, true);
  if (!low.ok) return;
  assert.equal(low.positionPct, 0);
  assert.equal(low.clamped, true);

  const high = buildOfferPriceRcnScale({ listingPrice: 1200000, recommendedAsk: 800000 });
  assert.equal(high.ok, true);
  if (!high.ok) return;
  assert.equal(high.positionPct, 100);
  assert.equal(high.clamped, true);
});

test('buildOfferPriceRcnScale rejects invalid inputs', () => {
  assert.equal(buildOfferPriceRcnScale({ listingPrice: 0, recommendedAsk: 100 }).ok, false);
  assert.equal(buildOfferPriceRcnScale({ listingPrice: 100, recommendedAsk: 0 }).ok, false);
});

test('formatRcnDeltaLabel shows signed PLN and percent', () => {
  assert.match(formatRcnDeltaLabel(-109152, -14.4), /−.*zł · −14,4%/);
  assert.match(formatRcnDeltaLabel(50000, 6.6), /\+.*zł · \+6,6%/);
});
