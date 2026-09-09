import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();
const guard = fs.readFileSync(path.join(ROOT, 'src/lib/coreGuard.ts'), 'utf8');
const runbooks = fs.readFileSync(path.join(ROOT, 'src/lib/coreGuardRunbooks.ts'), 'utf8');
const webRoute = fs.readFileSync(
  path.join(ROOT, 'src/app/api/admin/server/guard/route.ts'),
  'utf8',
);
const mobileRoute = fs.readFileSync(
  path.join(ROOT, 'src/app/api/mobile/v1/admin/core/guard/route.ts'),
  'utf8',
);
const migration = fs.readFileSync(
  path.join(ROOT, 'prisma/manual/sql/2026-09-09_core_guard_and_kei_worker.sql'),
  'utf8',
);

test('incident persistence deduplicates, cools down and resolves with hysteresis', () => {
  assert.match(migration, /UNIQUE KEY `CoreIncident_fingerprint_key`/);
  assert.match(guard, /INCIDENT_RESOLVE_MINUTES\s*=\s*7/);
  assert.match(guard, /ALERT_COOLDOWN_MINUTES\s*=\s*30/);
  assert.match(guard, /ON DUPLICATE KEY UPDATE/);
  assert.match(guard, /cooldownUntil < NOW/);
  assert.match(guard, /recoveryAlertAt IS NULL/);
});

test('repairs are serialized and both Guard APIs require administrators', () => {
  assert.match(runbooks, /GET_LOCK\('estateos_core_guard_repair'/);
  assert.match(runbooks, /RELEASE_LOCK\('estateos_core_guard_repair'\)/);
  assert.match(webRoute, /requireAdmin\(\)/);
  assert.match(mobileRoute, /requireMobileAdmin\(req\)/);
});
