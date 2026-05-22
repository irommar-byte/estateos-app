import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCreatePublicationPayload,
  extractOfferIdFromErrorBody,
  isPublicationActivationSkippedResponse,
} from '../../src/services/offerPublicationService';

test('buildCreatePublicationPayload does not auto-consume PLUS_CREDIT without explicit redemption', () => {
  const payload = buildCreatePublicationPayload({
    quote: {
      requiresPayment: false,
      allowedFreeFirst: false,
      reason: 'PLUS_CREDIT_AVAILABLE',
    },
  });
  assert.equal(payload, undefined);
});

test('buildCreatePublicationPayload uses PLUS_CREDIT when user chose it', () => {
  const payload = buildCreatePublicationPayload({
    redemption: { source: 'plus_credit' },
    quote: { requiresPayment: false, allowedFreeFirst: false },
  });
  assert.deepEqual(payload, { kind: 'PLUS_CREDIT', consumePlusPublication: true });
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

test('buildCreatePublicationPayload does not auto FREE_FIRST from quote alone', () => {
  const payload = buildCreatePublicationPayload({
    quote: { requiresPayment: false, allowedFreeFirst: true },
  });
  assert.equal(payload, undefined);
});

test('buildCreatePublicationPayload uses FREE_FIRST with welcome coupon redemption', () => {
  const payload = buildCreatePublicationPayload({
    redemption: {
      source: 'bonus_coupon',
      couponId: 'welcome_42',
      couponKind: 'welcome_coupon',
    },
  });
  assert.deepEqual(payload, {
    kind: 'FREE_FIRST',
    bonusCouponId: 'welcome_42',
    bonusCouponKind: 'welcome_coupon',
  });
});

test('isPublicationActivationSkippedResponse detects orphan create response', () => {
  assert.equal(
    isPublicationActivationSkippedResponse({
      activationSkipped: true,
      offer: { id: 901 },
      errorCode: 'PUBLICATION_REQUIRES_PLUS',
    }),
    true,
  );
  assert.equal(isPublicationActivationSkippedResponse({ errorCode: 'PUBLICATION_REQUIRES_PLUS' }), false);
});

test('extractOfferIdFromErrorBody reads offer id from error payload', () => {
  assert.equal(extractOfferIdFromErrorBody({ offer: { id: 42 } }), 42);
  assert.equal(extractOfferIdFromErrorBody({}), null);
});
