import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clientFeedbackChatMessage,
  serializeClientOfferFeedback,
} from '../src/lib/crm/clientPortalFeedback';

test('mirrors a client note into chat with offer context', () => {
  const feedback = serializeClientOfferFeedback({
    sentiment: 'maybe',
    note: 'Sprawdź proszę, czy można dokupić miejsce postojowe.',
  });

  const message = clientFeedbackChatMessage(feedback, 'Mieszkanie na Bemowie');

  assert.match(message || '', /Mieszkanie na Bemowie/);
  assert.match(message || '', /miejsce postojowe/);
});

test('does not add chip-only feedback to live chat', () => {
  const feedback = serializeClientOfferFeedback({
    sentiment: 'dislike',
    phrases: ['Za drogo'],
  });

  assert.equal(clientFeedbackChatMessage(feedback, 'Mieszkanie'), null);
});
