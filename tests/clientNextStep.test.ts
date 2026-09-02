import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveClientNextStep } from '../src/lib/crm/clientNextStep';

const buyer = {
  type: 'BUYER' as const,
  email: 'klient@example.com',
  phone: '+48500100200',
  linkedUserId: 10,
  hasCriteria: true,
  matchCount: 8,
  sentCount: 5,
  feedbackCount: 3,
};

test('a client question takes priority over generic buyer progress', () => {
  const next = resolveClientNextStep({
    ...buyer,
    pendingAgentTaskCount: 1,
    pendingAgentTaskHint: 'Sprawdź, czy można dokupić miejsce postojowe.',
  });
  assert.equal(next.action, 'respond_to_client');
  assert.match(next.hint, /miejsce postojowe/i);
});

test('feedback alone does not claim the client wants a viewing', () => {
  assert.equal(resolveClientNextStep(buyer).action, 'send_offers');
  assert.equal(
    resolveClientNextStep({ ...buyer, viewingIntentCount: 1 }).action,
    'propose_presentation',
  );
});
