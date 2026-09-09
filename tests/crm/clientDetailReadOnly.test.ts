import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('CRM client GET does not stamp or mutate acquisition data', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/crm/clients/[id]/route.ts'),
    'utf8',
  );
  const getBody = source.split('export async function GET')[1]?.split('export async function PATCH')[0] || '';
  assert.equal(/stampKwFromAcquisitionForm|\.create\(|\.update\(|\.upsert\(|\$executeRaw/.test(getBody), false);
});
