import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getFxSessionKey,
  getWarsawClock,
  isFxCacheValidForSession,
} from '../../src/money/fxSchedule';

describe('fxSchedule', () => {
  it('session key changes after 08:00 Warsaw boundary', () => {
    const before8 = Date.UTC(2026, 4, 22, 5, 30, 0);
    const after8 = Date.UTC(2026, 4, 22, 7, 5, 0);
    const keyBefore = getFxSessionKey(before8);
    const keyAfter = getFxSessionKey(after8);
    assert.notEqual(keyBefore, keyAfter);
  });

  it('cache valid only for matching session key', () => {
    const now = Date.UTC(2026, 4, 22, 10, 0, 0);
    const key = getFxSessionKey(now);
    assert.equal(isFxCacheValidForSession(key, now), true);
    assert.equal(isFxCacheValidForSession('2026-05-20', now), false);
  });

  it('getWarsawClock returns numeric parts', () => {
    const w = getWarsawClock(Date.UTC(2026, 4, 22, 12, 0, 0));
    assert.ok(w.year >= 2026);
    assert.ok(w.month >= 1 && w.month <= 12);
    assert.ok(w.day >= 1 && w.day <= 31);
    assert.ok(w.hour >= 0 && w.hour <= 23);
  });
});
