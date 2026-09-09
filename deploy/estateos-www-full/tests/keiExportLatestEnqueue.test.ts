import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('export-latest HTTP routes only enqueue KEI jobs', () => {
  for (const relativePath of [
    'src/app/api/admin/kei-amer/export-latest/route.ts',
    'src/app/api/mobile/v1/admin/kei-amer/export-latest/route.ts',
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
    assert.match(source, /enqueueKeiImportJob/);
    assert.doesNotMatch(source, /exportKeiListingsToEstateOS/);
    assert.doesNotMatch(source, /maxDuration = 300/);
  }
});

test('instrumentation does not start KEI import', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/instrumentation.ts'), 'utf8');
  assert.doesNotMatch(source, /kei|tickKeiAutoImport|runKeiImportJob/i);
});
