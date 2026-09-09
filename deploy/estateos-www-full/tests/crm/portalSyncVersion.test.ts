import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildPortalSyncVersion } from '../../src/lib/crm/portalSyncVersion';

test('portal sync version ignores empty stamps and keeps ISO order', () => {
  const a = new Date('2026-09-09T10:00:00.000Z');
  const b = new Date('2026-09-09T11:00:00.000Z');
  assert.equal(buildPortalSyncVersion([a, null, b, '']), `${a.toISOString()}|${b.toISOString()}`);
});

test('portal GET is read-only and exposes syncVersion', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/crm/client-portal/[token]/route.ts'),
    'utf8',
  );
  const getBody = source.split('export async function GET')[1]?.split('export async function POST')[0] || '';
  assert.equal(/touchPortalLinkedPresence|\.create\(|\.update\(|\.upsert\(|\$executeRaw/.test(getBody), false);
  assert.match(getBody, /syncVersion/);
});

test('portal live sync uses a dedicated lightweight route', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/crm/client-portal/[token]/sync/route.ts'),
    'utf8',
  );
  assert.match(source, /buildPortalSyncVersion/);
  assert.match(source, /touchPortalLinkedPresence/);
  assert.equal(source.includes('loadSellerPortalMarketing'), false);
});
