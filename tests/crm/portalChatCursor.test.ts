import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePortalChatCursor } from '../../src/lib/crm/portalChat';

test('portal chat accepts a recent incremental cursor', () => {
  const iso = new Date(Date.now() - 5_000).toISOString();
  assert.equal(parsePortalChatCursor(iso)?.toISOString(), iso);
});

test('portal chat rejects invalid, future and stale cursors', () => {
  assert.equal(parsePortalChatCursor('not-a-date'), null);
  assert.equal(parsePortalChatCursor(new Date(Date.now() + 5 * 60_000).toISOString()), null);
  assert.equal(parsePortalChatCursor(new Date(Date.now() - 31 * 24 * 60 * 60_000).toISOString()), null);
});
