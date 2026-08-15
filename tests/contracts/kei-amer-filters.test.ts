import test from 'node:test';
import assert from 'node:assert/strict';
import { keiFallbackDatePresets } from '../../src/contracts/keiAmerContract';

test('kei date presets use calendar offsets from a fixed day', () => {
  const presets = keiFallbackDatePresets(new Date('2026-08-15T12:00:00'));
  assert.equal(presets.find((p) => p.id === '7d')?.dateFrom, '2026-08-08');
  assert.equal(presets.find((p) => p.id === '30d')?.dateFrom, '2026-07-16');
  assert.equal(presets.find((p) => p.id === 'older90')?.dateTo, '2026-05-16');
});
