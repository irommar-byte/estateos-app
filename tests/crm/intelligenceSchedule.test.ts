import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isWithinSendWindow,
  resolveIntelligenceMode,
  tempoFromSettings,
  warsawDayStart,
} from '@/lib/crm/intelligenceSchedule';

test('okno wysyłki liczone w czasie polskim (lato, UTC+2)', () => {
  // Środa 22.07.2026 06:30 UTC = 08:30 w Warszawie → w oknie
  assert.equal(isWithinSendWindow(new Date('2026-07-22T06:30:00Z')), true);
  // 05:30 UTC = 07:30 w Warszawie → poza oknem
  assert.equal(isWithinSendWindow(new Date('2026-07-22T05:30:00Z')), false);
  // 18:30 UTC = 20:30 → poza oknem
  assert.equal(isWithinSendWindow(new Date('2026-07-22T18:30:00Z')), false);
});

test('okno wysyłki: zima (UTC+1) i weekend', () => {
  // Poniedziałek 7.12.2026 07:10 UTC = 08:10 w Warszawie
  assert.equal(isWithinSendWindow(new Date('2026-12-07T07:10:00Z')), true);
  // Sobota 5.12.2026 10:00 UTC
  assert.equal(isWithinSendWindow(new Date('2026-12-05T10:00:00Z')), false);
});

test('północ w Warszawie', () => {
  assert.equal(warsawDayStart(new Date('2026-07-22T10:00:00Z')).toISOString(), '2026-07-21T22:00:00.000Z');
  assert.equal(warsawDayStart(new Date('2026-12-07T10:00:00Z')).toISOString(), '2026-12-06T23:00:00.000Z');
  // 23:30 UTC 21.07 to już 22.07 w Warszawie
  assert.equal(warsawDayStart(new Date('2026-07-21T23:30:00Z')).toISOString(), '2026-07-21T22:00:00.000Z');
});

test('tryb: TRIAL przez 7 dni z akceptacją, potem autopilot', () => {
  const now = new Date('2026-10-23T10:00:00Z');
  assert.equal(resolveIntelligenceMode({ intelligenceMode: 'TRIAL', createdAt: '2026-10-20T10:00:00Z' }, now).effective, 'APPROVAL');
  assert.equal(resolveIntelligenceMode({ intelligenceMode: 'TRIAL', createdAt: '2026-10-10T10:00:00Z' }, now).effective, 'AUTOPILOT');
  assert.equal(resolveIntelligenceMode({ intelligenceMode: 'APPROVAL', createdAt: '2020-01-01' }, now).effective, 'APPROVAL');
  assert.equal(resolveIntelligenceMode({ intelligenceMode: null }, now).effective, 'AUTOPILOT');
});

test('tempo z ustawień', () => {
  assert.equal(tempoFromSettings(24, 1), 'STANDARD');
  assert.equal(tempoFromSettings(72, 1), 'CALM');
  assert.equal(tempoFromSettings(12, 2), 'INTENSIVE');
  assert.equal(tempoFromSettings(6, 3), 'CUSTOM');
});
