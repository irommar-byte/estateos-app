import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCoreLogQuery } from '../src/lib/adminCoreLogs';
import { productionInSync } from '../src/lib/adminCoreProduction';
import { isAllowedPm2Action, isAllowedPm2Name, pm2ProcessKind } from '../src/lib/adminServerOps';

test('log query clamps name stream and lines', () => {
  const ok = parseCoreLogQuery(new URLSearchParams('name=nieruchomosci&stream=error&lines=80'));
  assert.equal(ok.name, 'nieruchomosci');
  assert.equal(ok.stream, 'error');
  assert.equal(ok.lines, 80);

  const fallback = parseCoreLogQuery(new URLSearchParams('name=../etc/passwd&stream=all&lines=9999'));
  assert.equal(fallback.name, 'nieruchomosci');
  assert.equal(fallback.stream, 'both');
  assert.equal(fallback.lines, 500);

  const floor = parseCoreLogQuery(new URLSearchParams('name=kei-auto-import&stream=out&lines=1'));
  assert.equal(floor.name, 'kei-auto-import');
  assert.equal(floor.stream, 'out');
  assert.equal(floor.lines, 20);
});

test('pm2 whitelist includes cron jobs and reload', () => {
  assert.equal(isAllowedPm2Name('nieruchomosci'), true);
  assert.equal(isAllowedPm2Name('kei-auto-import'), true);
  assert.equal(isAllowedPm2Name('seller-marketing-renewals'), true);
  assert.equal(isAllowedPm2Name('not-a-process'), false);
  assert.equal(isAllowedPm2Action('reload'), true);
  assert.equal(isAllowedPm2Action('restart'), true);
  assert.equal(isAllowedPm2Action('kill'), false);
  assert.equal(pm2ProcessKind('nieruchomosci'), 'daemon');
  assert.equal(pm2ProcessKind('client-intelligence'), 'cron');
});

test('production inSync requires identical git env and process sha', () => {
  assert.equal(productionInSync('7d412ac9', '7d412ac9', '7d412ac9'), true);
  assert.equal(productionInSync('7d412ac9', '7d412ac9', '8cf5f49bc'), false);
  assert.equal(productionInSync('', '7d412ac9', '7d412ac9'), false);
});
