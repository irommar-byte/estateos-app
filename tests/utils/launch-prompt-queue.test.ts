import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getActiveLaunchPrompt,
  requestLaunchPrompt,
  releaseLaunchPrompt,
  resetLaunchPromptQueueForTests,
} from '../../src/lib/launchPromptQueue';

test('launch prompt queue serves passkey before intelligence and rating', () => {
  resetLaunchPromptQueueForTests();
  requestLaunchPrompt('rating');
  requestLaunchPrompt('intelligence');
  requestLaunchPrompt('passkey');
  assert.equal(getActiveLaunchPrompt(), 'passkey');
  releaseLaunchPrompt('passkey');
  assert.equal(getActiveLaunchPrompt(), 'intelligence');
  releaseLaunchPrompt('intelligence');
  assert.equal(getActiveLaunchPrompt(), 'rating');
  releaseLaunchPrompt('rating');
  assert.equal(getActiveLaunchPrompt(), null);
});

test('intelligence enable snooze timestamp is active only in the future', () => {
  const now = 1_700_000_000_000;
  const isActive = (raw: string | null, at: number) => {
    const until = Number(raw);
    return Number.isFinite(until) && until > at;
  };
  assert.equal(isActive(String(now + 1000), now), true);
  assert.equal(isActive(String(now - 1), now), false);
  assert.equal(isActive(null, now), false);
});
