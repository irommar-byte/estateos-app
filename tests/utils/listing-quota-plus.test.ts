import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAdditionalListingSlots,
  hasAdditionalPlusPublication,
  hasUnlimitedListingAccess,
  isPlusCreditActive,
  userAfterPakietPlusPurchase,
  applyOptimisticPlusPublicationSlot,
} from '../../src/utils/listingQuota';

const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

test('isPlusCreditActive requires slots and valid plusExpiresAt', () => {
  assert.equal(isPlusCreditActive({ extraListings: 2, plusExpiresAt: future }), true);
  assert.equal(isPlusCreditActive({ extraListings: 2, plusExpiresAt: past }), false);
  assert.equal(isPlusCreditActive({ extraListings: 0, plusExpiresAt: future }), false);
  assert.equal(isPlusCreditActive({ extraListings: 1 }), false);
});

test('applyOptimisticPlusPublicationSlot increments counter', () => {
  const next = applyOptimisticPlusPublicationSlot({ id: 1, extraListings: 0 });
  assert.equal(getAdditionalListingSlots(next), 1);
  assert.ok(next?.plusExpiresAt);
});

test('AGENCY planType no longer grants unlimited listing access', () => {
  assert.equal(
    hasUnlimitedListingAccess({ planType: 'AGENCY', role: 'AGENT', extraListings: 0 }),
    false,
  );
});

test('userAfterPakietPlusPurchase uses server extraListings', () => {
  const next = userAfterPakietPlusPurchase(
    { id: 1, extraListings: 0, plusExpiresAt: future },
    { backendRegistered: true, extraListings: 3, plusExpiresAt: future },
  );
  assert.equal(getAdditionalListingSlots(next), 3);
  assert.equal(hasAdditionalPlusPublication(next), true);
});
