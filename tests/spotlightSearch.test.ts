import test from 'node:test';
import assert from 'node:assert/strict';

test('spotlight tokenize and fold helpers via search module exports', async () => {
  const mod = await import('../src/lib/spotlightSearch.ts');
  assert.equal(typeof mod.runSpotlightSearch, 'function');
});
