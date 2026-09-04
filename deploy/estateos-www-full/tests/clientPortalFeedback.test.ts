import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clientFeedbackChatMessage,
  serializeClientOfferFeedback,
} from '../src/lib/crm/clientPortalFeedback';

test('mirrors a client note into chat without repeating the offer title in the body', () => {
  const feedback = serializeClientOfferFeedback({
    sentiment: 'maybe',
    note: 'Sprawdź proszę, czy można dokupić miejsce postojowe.',
  });

  const message = clientFeedbackChatMessage(feedback, 'Mieszkanie na Bemowie');

  assert.equal(message, 'Sprawdź proszę, czy można dokupić miejsce postojowe.');
  assert.doesNotMatch(message || '', /Reakcja do oferty/);
});

test('does not add chip-only feedback to live chat', () => {
  const feedback = serializeClientOfferFeedback({
    sentiment: 'dislike',
    phrases: ['Za drogo'],
  });

  assert.equal(clientFeedbackChatMessage(feedback, 'Mieszkanie'), null);
});
