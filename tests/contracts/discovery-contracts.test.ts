import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDiscoveryEventPayload,
  parseDiscoveryFeedItems,
  validateDiscoveryEventPayload,
} from '../../src/contracts/discoveryContracts';

test('discovery event payload validates canonical fields', () => {
  const payload = buildDiscoveryEventPayload({
    eventType: 'DISCOVERY_LIKE',
    offerId: 123,
    photoIndex: 1,
    score: 87,
    platform: 'ios',
  });
  assert.ok(payload);
  assert.equal(payload?.eventType, 'DISCOVERY_LIKE');
  assert.equal(payload?.offerId, 123);
  assert.equal(payload?.photoIndex, 1);
  assert.equal(payload?.score, 87);
  assert.equal(payload?.source, 'mobile_discovery');
});

test('discovery dislike reason event requires reasonCode', () => {
  const missingReason = validateDiscoveryEventPayload({
    eventType: 'DISCOVERY_DISLIKE_REASON',
    offerId: 111,
    platform: 'android',
    at: new Date().toISOString(),
  });
  assert.equal(missingReason, null);

  const okReason = validateDiscoveryEventPayload({
    eventType: 'DISCOVERY_DISLIKE_REASON',
    offerId: 111,
    reasonCode: 'PRICE_TOO_HIGH',
    platform: 'android',
    at: new Date().toISOString(),
  });
  assert.ok(okReason);
  assert.equal(okReason?.reasonCode, 'PRICE_TOO_HIGH');
});

test('discovery feed parser supports offers/items payload', () => {
  const fromOffers = parseDiscoveryFeedItems({
    offers: [{ id: 1, score: 91, reason: 'lokalizacja' }],
  });
  assert.equal(fromOffers.length, 1);
  assert.equal(fromOffers[0].id, 1);
  assert.equal(fromOffers[0].score, 91);

  const fromItems = parseDiscoveryFeedItems({
    items: [{ offerId: 7, matchScore: 74, reason: 'metraż' }],
  });
  assert.equal(fromItems.length, 1);
  assert.equal(fromItems[0].id, 7);
  assert.equal(fromItems[0].score, 74);
});
