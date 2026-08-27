import test from 'node:test';
import assert from 'node:assert/strict';

test('spotlight empty query returns no results', async () => {
  const { runSpotlightSearch } = await import('../src/lib/spotlightSearch');
  const results = await runSpotlightSearch('   ');
  assert.equal(results.length, 0);
});
