import test from 'node:test';
import assert from 'node:assert/strict';
import { portalChatNotifyTarget } from '../src/lib/crm/portalChatNotify';

test('client portal message always notifies the agent, even when contact is mirrored', () => {
  assert.equal(
    portalChatNotifyTarget({ from: 'client', contactMirrored: true }),
    'agent',
  );
  assert.equal(
    portalChatNotifyTarget({ from: 'client', contactMirrored: false }),
    'agent',
  );
});

test('agent replies still notify the client portal', () => {
  assert.equal(portalChatNotifyTarget({ from: 'agent' }), 'client');
});

test('activity-only feedback mirror does not send a second push', () => {
  assert.equal(
    portalChatNotifyTarget({ from: 'client', activityOnly: true }),
    'none',
  );
});
