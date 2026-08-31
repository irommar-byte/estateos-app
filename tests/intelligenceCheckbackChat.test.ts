import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapChatTextToCheckbackOption,
  normalizeChatReplyText,
} from '../src/lib/crm/intelligenceCheckbackChat';

const yesNoOptions = [
  { id: 'yes', label: 'Tak, zgadza się' },
  { id: 'no', label: 'Nie — poprawię' },
];

test('normalizeChatReplyText strips accents', () => {
  assert.equal(normalizeChatReplyText('Dokładnie'), 'dokladnie');
});

test('mapChatTextToCheckbackOption maps dokladnie to yes', () => {
  assert.equal(mapChatTextToCheckbackOption('Dokladnie', yesNoOptions), 'yes');
  assert.equal(mapChatTextToCheckbackOption('Dokładnie', yesNoOptions), 'yes');
  assert.equal(mapChatTextToCheckbackOption('tak', yesNoOptions), 'yes');
  assert.equal(mapChatTextToCheckbackOption('nie', yesNoOptions), 'no');
  assert.equal(mapChatTextToCheckbackOption('poprawię', yesNoOptions), 'no');
});

test('mapChatTextToCheckbackOption returns null for unrelated long text', () => {
  assert.equal(
    mapChatTextToCheckbackOption('Czy możemy umówić spotkanie w środę o 17?', yesNoOptions),
    null,
  );
});
