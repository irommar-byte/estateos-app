import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDiscoveryIncomingEvent } from '../src/lib/discovery/events';
import { parseTasteNote } from '../src/lib/discovery/parseTasteNote';

test('za drogo becomes PRICE_TOO_HIGH', () => {
  assert.equal(parseTasteNote('Za drogo, nie stać mnie.').reasonCode, 'PRICE_TOO_HIGH');
});

test('dislike event with only a Polish note infers reasonCode and stores note:', () => {
  const parsed = parseDiscoveryIncomingEvent({
    eventType: 'DISCOVERY_DISLIKE',
    offerId: 42,
    platform: 'ios',
    source: 'mobile_discovery',
    reasonNote: 'Nie ta dzielnica, nie chcę na Woli.',
    at: new Date().toISOString(),
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.event.reasonCode, 'LOCATION_MISMATCH');
  assert.ok(String(parsed.event.correctionTarget || '').startsWith('note:'));
});
