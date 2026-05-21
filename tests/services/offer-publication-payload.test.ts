import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCreatePublicationPayload } from '../../src/services/offerPublicationService';

test('buildCreatePublicationPayload uses PLUS_CREDIT when quote allows without tx', () => {
  const payload = buildCreatePublicationPayload({
    quote: {
      requiresPayment: false,
      allowedFreeFirst: false,
      reason: 'PLUS_CREDIT_AVAILABLE',
    },
  });
  assert.deepEqual(payload, { kind: 'PLUS_CREDIT' });
});

test('buildCreatePublicationPayload prefers IAP tx over quote', () => {
  const payload = buildCreatePublicationPayload({
    plusTransactionId: 'ios:123',
    quote: { requiresPayment: false, allowedFreeFirst: false },
  });
  assert.equal(payload?.kind, 'PLUS_PAID');
  assert.equal(payload?.iapTransactionId, 'ios:123');
  assert.equal(payload?.consumePlusPublication, true);
});

test('buildCreatePublicationPayload uses FREE_FIRST when allowed', () => {
  const payload = buildCreatePublicationPayload({
    quote: { requiresPayment: false, allowedFreeFirst: true },
  });
  assert.deepEqual(payload, { kind: 'FREE_FIRST' });
});
