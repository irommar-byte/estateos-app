import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFeedbackSignals,
  parseMaxPriceFromText,
  parseMinRoomsFromText,
  parseMinYearFromText,
} from '../src/lib/crm/feedbackSignals';
import { serializeClientOfferFeedback } from '../src/lib/crm/clientPortalFeedback';

test('parseMinYearFromText understands od 2000 and za stare', () => {
  assert.equal(parseMinYearFromText('Od 2000 roku poproszę, nie starsze.'), 2000);
  assert.equal(parseMinYearFromText('Za stare'), 2000);
  assert.equal(parseMinYearFromText('Tylko 2015 i wyżej'), 2015);
});

test('parseMinRoomsFromText understands conajmniej 2 pokojowe', () => {
  assert.equal(parseMinRoomsFromText('Conajmniej 2 pokojowe mieszkanie'), 2);
  assert.equal(parseMinRoomsFromText('kawalerka nie'), 2);
  assert.equal(parseMinRoomsFromText('minimum 3 pok'), 3);
});

test('extractFeedbackSignals from disliked free text', () => {
  const feedback = serializeClientOfferFeedback({
    sentiment: 'dislike',
    disliked: 'Za stare',
    note: 'Od 2000 roku poproszę, nie starsze.',
    phrases: [],
  });
  const parsed = JSON.parse(feedback);
  const signals = extractFeedbackSignals(parsed);
  assert.ok(signals.some((s) => s.kind === 'minYear' && s.value === 2000));
});

test('parseMaxPriceFromText understands maksymalnie and tys', () => {
  assert.equal(parseMaxPriceFromText('Maksymalnie 900000 zł'), 900_000);
  assert.equal(parseMaxPriceFromText('Budżet max 850 tys'), 850_000);
});

test('extractFeedbackSignals from note with max price', () => {
  const signals = extractFeedbackSignals({
    sentiment: 'dislike',
    liked: '',
    disliked: '',
    note: 'Maksymalnie 900000 zł',
    phrases: ['Za drogo'],
  });
  assert.ok(signals.some((s) => s.kind === 'maxPrice' && s.value === 900_000));
});

test('extractFeedbackSignals from chip Za mało pokoi', () => {
  const signals = extractFeedbackSignals({
    sentiment: 'dislike',
    liked: '',
    disliked: '',
    note: '',
    phrases: ['Za mało pokoi'],
  });
  assert.ok(signals.some((s) => s.kind === 'minRooms' && s.value === 2));
});
