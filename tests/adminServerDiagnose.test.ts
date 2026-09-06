import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePsEtimeToSec, summarizeFindings, type ServerFinding } from '../src/lib/adminServerDiagnose';

test('parse ps etime', () => {
  assert.equal(parsePsEtimeToSec('41:15'), 41 * 60 + 15);
  assert.equal(parsePsEtimeToSec('01:11:27'), 3600 + 11 * 60 + 27);
  assert.equal(parsePsEtimeToSec('2-01:11:27'), 2 * 86400 + 3600 + 11 * 60 + 27);
});

test('healthy when no findings', () => {
  const rollup = summarizeFindings([]);
  assert.equal(rollup.healthy, true);
  assert.equal(rollup.level, 'ok');
});

test('critical beats warning', () => {
  const findings: ServerFinding[] = [
    { id: 'junk', severity: 'warning', title: 'x', detail: 'y', fixable: true },
    { id: 'db', severity: 'critical', title: 'x', detail: 'y', fixable: true },
  ];
  const rollup = summarizeFindings(findings);
  assert.equal(rollup.level, 'critical');
  assert.equal(rollup.healthy, false);
});
