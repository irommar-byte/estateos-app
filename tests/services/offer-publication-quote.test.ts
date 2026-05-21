import test from 'node:test';
import assert from 'node:assert/strict';

import { decideReactivationFromQuote } from '../../src/services/offerPublicationService';
import type { PublicationQuote } from '../../src/contracts/offerPublicationContract';

function quoteRes(
  ok: boolean,
  status: number,
  quote: Partial<PublicationQuote> = {},
) {
  return {
    ok,
    status,
    quote: { requiresPayment: false, ...quote } as PublicationQuote,
  };
}

test('proceeds to IAP when quote is OK and payment required', () => {
  assert.equal(
    decideReactivationFromQuote(
      quoteRes(true, 200, { requiresPayment: true, kind: 'PLUS_PAID' }),
    ).action,
    'iap',
  );
});

test('activates without IAP when server says no payment', () => {
  assert.equal(
    decideReactivationFromQuote(
      quoteRes(true, 200, { requiresPayment: false, kind: 'FREE_FIRST' }),
    ).action,
    'activate_free',
  );
});

test('blocks on network loss', () => {
  assert.equal(decideReactivationFromQuote(quoteRes(false, 0)).action, 'block');
});

test('blocks on auth errors', () => {
  assert.equal(decideReactivationFromQuote(quoteRes(false, 401)).action, 'block');
  assert.equal(decideReactivationFromQuote(quoteRes(false, 403)).action, 'block');
});

test('still allows IAP when quote endpoint is missing or server error', () => {
  assert.equal(decideReactivationFromQuote(quoteRes(false, 404)).action, 'iap');
  assert.equal(decideReactivationFromQuote(quoteRes(false, 500)).action, 'iap');
  assert.equal(decideReactivationFromQuote(quoteRes(false, 502)).action, 'iap');
});

test('blocks on client validation errors from server', () => {
  assert.equal(decideReactivationFromQuote(quoteRes(false, 422)).action, 'block');
  assert.equal(decideReactivationFromQuote(quoteRes(false, 400)).action, 'block');
});
