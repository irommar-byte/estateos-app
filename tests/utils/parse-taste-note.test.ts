import test from 'node:test';
import assert from 'node:assert/strict';
import { noteCorrectionTarget, parseTasteNote } from '../../src/lib/discovery/parseTasteNote';

test('parseTasteNote maps price phrases to PRICE_TOO_HIGH', () => {
  const parsed = parseTasteNote('Za drogo na tę kawalerkę, poza budżetem.');
  assert.equal(parsed.reasonCode, 'PRICE_TOO_HIGH');
  assert.ok(parsed.tags.includes('price'));
});

test('parseTasteNote maps district rejection to LOCATION_MISMATCH + correction', () => {
  const parsed = parseTasteNote('Nie ta dzielnica, nie chcę na Woli.');
  assert.equal(parsed.reasonCode, 'LOCATION_MISMATCH');
  assert.equal(parsed.correctionTarget, 'district:Wola');
});

test('parseTasteNote maps layout phrases including balcony', () => {
  const parsed = parseTasteNote('Brak balkonu i za mała kuchnia.');
  assert.equal(parsed.reasonCode, 'LAYOUT_MISMATCH');
});

test('parseTasteNote leaves unstructured short notes without a fake reason', () => {
  const parsed = parseTasteNote('hmm');
  assert.equal(parsed.reasonCode, null);
  assert.equal(parsed.correctionTarget, null);
});

test('noteCorrectionTarget stores a capped note: prefix for pulse lastNotes', () => {
  assert.equal(noteCorrectionTarget('  za drogo  '), 'note:za drogo');
  assert.equal(noteCorrectionTarget(''), '');
});
