import assert from 'node:assert/strict';
import {
  createDiscoveryProfileSnapshot,
  diversifiedDiscoveryRank,
  emptyPreferenceVector,
  emptyTasteVector,
  scoreDiscoveryCandidate,
} from '../src/lib/discovery/engine';
import { updateDiscoveryProfileFromEvent } from '../src/lib/discovery/behaviour';
import { planDiscoveryGallery } from '../src/lib/discovery/gallery';
import type { DiscoveryCandidate, DiscoveryIncomingEvent } from '../src/lib/discovery/types';

const baseCandidate: DiscoveryCandidate = {
  id: 1,
  title: 'Światło i cisza',
  price: 900_000,
  pricePln: 900_000,
  priceCurrency: 'PLN',
  listPricePln: null,
  city: 'Warszawa',
  district: 'Mokotów',
  propertyType: 'FLAT',
  transactionType: 'SELL',
  area: 60,
  rooms: 3,
  hasBalcony: true,
  hasParking: true,
  hasGarden: false,
  hasElevator: true,
  isFurnished: false,
  images: '["/one.jpg","/two.jpg","/three.jpg"]',
  status: 'ACTIVE',
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const initial = createDiscoveryProfileSnapshot({
  tasteVector: emptyTasteVector(),
  preferenceVector: emptyPreferenceVector(),
  confidence: 0,
  contradictionIndex: 0,
  explorationHunger: 1,
  searchPhase: 'ACTIVE',
});

const like: DiscoveryIncomingEvent = {
  eventType: 'DISCOVERY_LIKE',
  offerId: 1,
  sessionId: 'session_test',
  source: 'mobile_discovery',
  platform: 'ios',
  at: new Date(),
};

const updated = updateDiscoveryProfileFromEvent({ existing: initial, event: like, candidate: baseCandidate });
assert.equal(updated.tasteVector.affinity.city.Warszawa, 1);
assert.ok(updated.confidence > 0);

const score = scoreDiscoveryCandidate({
  candidate: baseCandidate,
  profile: updated,
  recentShown: new Set(),
  recentDisliked: new Set(),
  recentLiked: new Set(),
});
assert.ok(score.score > 50);
assert.ok(score.reasons.length > 0);
assert.ok(score.scoreComponents.priceAffinity >= 0);

const gallery = planDiscoveryGallery(baseCandidate.images);
assert.deepEqual(gallery.orderedAssets, ['/one.jpg', '/two.jpg', '/three.jpg']);
assert.equal(gallery.assetRoles[0].role, 'HERO');

const ranked = diversifiedDiscoveryRank([score, { ...score, id: 2, district: 'Śródmieście' }], 2);
assert.equal(ranked.length, 2);

const visitNo: DiscoveryIncomingEvent = {
  ...like,
  eventType: 'DISCOVERY_VISIT_FEEDBACK',
  visitOutcome: 'NO',
};
const afterVisit = updateDiscoveryProfileFromEvent({ existing: updated, event: visitNo, candidate: baseCandidate });
assert.equal(afterVisit.tasteVector.behavioural.visitNegativeCount, 1);

console.log('discovery-foundation.check.ts OK');
