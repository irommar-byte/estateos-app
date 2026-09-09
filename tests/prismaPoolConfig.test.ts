import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPrismaDatabaseUrl } from '../src/lib/prisma';

test('Prisma URL gets bounded pool and timeout defaults', () => {
  const result = buildPrismaDatabaseUrl('mysql://user:pass@localhost:3306/estateos');
  const url = new URL(result!);
  assert.equal(url.searchParams.get('connection_limit'), '6');
  assert.equal(url.searchParams.get('pool_timeout'), '10');
  assert.equal(url.searchParams.get('connect_timeout'), '5');
});

test('Prisma URL preserves explicit operator settings', () => {
  const result = buildPrismaDatabaseUrl(
    'mysql://user:pass@localhost:3306/estateos?connection_limit=3&pool_timeout=7',
  );
  const url = new URL(result!);
  assert.equal(url.searchParams.get('connection_limit'), '3');
  assert.equal(url.searchParams.get('pool_timeout'), '7');
});
