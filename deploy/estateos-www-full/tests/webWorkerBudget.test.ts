import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WEB_RECYCLE_MIN_UPTIME_MS,
  shouldFlagHealthSlow,
  shouldFlagWebMemory,
  shouldRecycleWebWorker,
} from '../src/lib/webWorkerBudget';

const warmed = 20 * 60_000;

test('a warmed Next 16 worker around 900 MB is normal on the 4 GB VPS', () => {
  assert.equal(shouldRecycleWebWorker(900 * 1024 * 1024, warmed), false);
  assert.equal(
    shouldFlagWebMemory({
      maxRssBytes: 967 * 1024 * 1024,
      totalRssBytes: 1700 * 1024 * 1024,
      maxUptimeMs: warmed,
    }),
    false,
  );
});

test('fresh workers after deploy do not page CORE Naprawa', () => {
  assert.equal(
    shouldFlagWebMemory({
      maxRssBytes: 990 * 1024 * 1024,
      totalRssBytes: 1800 * 1024 * 1024,
      maxUptimeMs: 4 * 60_000,
    }),
    false,
  );
  assert.equal(shouldRecycleWebWorker(990 * 1024 * 1024, 4 * 60_000), false);
  assert.ok(WEB_RECYCLE_MIN_UPTIME_MS > 4 * 60_000);
});

test('recycle only when RSS is about to hit the 1 GiB PM2 kill', () => {
  assert.equal(shouldRecycleWebWorker(970 * 1024 * 1024, warmed), true);
  assert.equal(
    shouldFlagWebMemory({
      maxRssBytes: 985 * 1024 * 1024,
      totalRssBytes: 1800 * 1024 * 1024,
      maxUptimeMs: warmed,
    }),
    true,
  );
});

test('a single 2.0 s health ping is not a slow-app outage', () => {
  assert.equal(shouldFlagHealthSlow(2018, true), false);
  assert.equal(shouldFlagHealthSlow(3000, true), true);
  assert.equal(shouldFlagHealthSlow(8000, false), false);
});
