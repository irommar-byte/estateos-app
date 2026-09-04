import test from 'node:test';
import assert from 'node:assert/strict';
import { marketStatusFromVsMedianPct, parsePurpose } from '../../src/lib/market/parseSubject';

test('parsePurpose accepts status redaction purpose', () => {
  assert.equal(parsePurpose('status'), 'status');
  assert.equal(parsePurpose('consumer'), 'consumer');
});

test('marketStatusFromVsMedianPct matches ±5% mobile banners', () => {
  assert.equal(marketStatusFromVsMedianPct(-5), 'bargain');
  assert.equal(marketStatusFromVsMedianPct(-14.4), 'bargain');
  assert.equal(marketStatusFromVsMedianPct(0), 'market');
  assert.equal(marketStatusFromVsMedianPct(5), 'luxury');
});
