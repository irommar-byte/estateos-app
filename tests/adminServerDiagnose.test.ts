import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FINDING_RUNBOOK_ID,
  healthScore,
  parsePsEtimeToSec,
  sameCommitSha,
  shouldFlagStaleWwwCommit,
  summarizeFindings,
  type ServerFinding,
} from '../src/lib/adminServerDiagnose';

test('parse ps etime', () => {
  assert.equal(parsePsEtimeToSec('41:15'), 41 * 60 + 15);
  assert.equal(parsePsEtimeToSec('01:11:27'), 3600 + 11 * 60 + 27);
  assert.equal(parsePsEtimeToSec('2-01:11:27'), 2 * 86400 + 3600 + 11 * 60 + 27);
});

test('healthy when no findings', () => {
  const rollup = summarizeFindings([]);
  assert.equal(rollup.healthy, true);
  assert.equal(rollup.level, 'ok');
  assert.equal(rollup.score, 100);
  assert.equal(healthScore([]), 100);
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

test('git HEAD after nginx-only deploy is not a stale WWW worker', () => {
  assert.equal(sameCommitSha('e296bb76e', 'e296bb76'), true);
  assert.equal(shouldFlagStaleWwwCommit('e296bb76e', 'e296bb76e'), false);
  assert.equal(shouldFlagStaleWwwCommit('e296bb76e', ''), false);
  assert.equal(shouldFlagStaleWwwCommit('e296bb76e', '2f6b3f8d4'), true);
  assert.equal(shouldFlagStaleWwwCommit('e296bb76e', 'unknown'), true);
});

test('real WWW outage maps to automatic recycle', () => {
  assert.equal(FINDING_RUNBOOK_ID['health-down'], 'recycle-web');
  assert.equal(FINDING_RUNBOOK_ID['commit-stale'], 'recycle-web');
});
