import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canUndoDiscovery,
  createDiscoveryUndo,
  resolveDiscoveryEntryRoute,
  shouldAskDiscoveryDislikeReason,
} from '../../src/utils/discoveryExperienceState';

test('Discovery undo remains available only inside its care window', () => {
  const state = createDiscoveryUndo({ id: 'offer-1' }, 1_000, 7_000);
  assert.equal(canUndoDiscovery(state, 7_999), true);
  assert.equal(canUndoDiscovery(state, 8_000), false);
});

test('Discovery dislike reasons stay optional and sparse', () => {
  assert.equal(shouldAskDiscoveryDislikeReason(1), false);
  assert.equal(shouldAskDiscoveryDislikeReason(2), false);
  assert.equal(shouldAskDiscoveryDislikeReason(3), true);
  assert.equal(shouldAskDiscoveryDislikeReason(6), true);
});

test('Discovery entry ritual is shown only before first completed entry', () => {
  assert.equal(resolveDiscoveryEntryRoute(false), 'DiscoveryEntry');
  assert.equal(resolveDiscoveryEntryRoute(true), 'EstateDiscovery');
});
