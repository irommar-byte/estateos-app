import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('legacy KEI heartbeat scripts no longer call HTTP workers', () => {
  for (const relativePath of ['scripts/kei-auto-import.cjs', 'scripts/kei-auto-import.ts']) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
    assert.match(source, /kei-import-worker/);
    assert.doesNotMatch(source, /\/api\/cron\/kei-auto-import/);
    assert.doesNotMatch(source, /runCronHeartbeat/);
  }
});
