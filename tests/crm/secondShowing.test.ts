import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePresentation, JOURNEY_ACTIVITY } from '../../src/lib/crm/clientJourney';
import { clientFacingWhyLine } from '../../src/lib/crm/clientIntelligence';
import { buildOfferDialogueTurn } from '../../src/lib/crm/intelligenceDialogue';

const at = (iso: string) => new Date(iso);

test('second showing after a held one is not marked as held', () => {
  const activities = [
    { id: 1, kind: JOURNEY_ACTIVITY.PRESENTATION, title: null, body: null, offerId: 10, createdAt: at('2026-10-01T10:00:00Z'),
      metadata: { startsAt: '2026-10-03T10:00:00Z', status: 'confirmed', proposedBy: 'agent', offerId: 10 } },
    { id: 2, kind: JOURNEY_ACTIVITY.PRESENTATION_HELD, title: null, body: null, offerId: 10, createdAt: at('2026-10-03T12:00:00Z'),
      metadata: { heldAt: '2026-10-03T12:00:00Z', offerId: 10 } },
    { id: 3, kind: JOURNEY_ACTIVITY.PRESENTATION, title: null, body: null, offerId: 20, createdAt: at('2026-10-05T09:00:00Z'),
      metadata: { startsAt: '2026-10-08T10:00:00Z', status: 'pending', proposedBy: 'agent', offerId: 20 } },
  ];
  const slot = resolvePresentation(activities);
  assert.ok(slot);
  assert.equal(slot.offerId, 20);
  assert.equal(slot.heldAt ?? null, null);
});

test('a showing held after it was proposed is marked as held', () => {
  const activities = [
    { id: 1, kind: JOURNEY_ACTIVITY.PRESENTATION, title: null, body: null, offerId: 10, createdAt: at('2026-10-01T10:00:00Z'),
      metadata: { startsAt: '2026-10-03T10:00:00Z', status: 'confirmed', proposedBy: 'agent', offerId: 10 } },
    { id: 2, kind: JOURNEY_ACTIVITY.PRESENTATION_HELD, title: null, body: null, offerId: 10, createdAt: at('2026-10-03T12:00:00Z'),
      metadata: { heldAt: '2026-10-03T12:00:00Z', offerId: 10 } },
  ];
  assert.ok(resolvePresentation(activities)?.heldAt);
});

test('internal reasons never reach the client letter', () => {
  const internal = [
    'Cena przekracza roboczy poziom 650 000 zł wyuczony z reakcji; to silna kara do czasu potwierdzenia budżetu.',
    'Nauka z reakcji wskazuje 3 pokoje; układ 2 pok. dostaje karę, ale nie jest automatycznie odrzucany.',
    'W opisie jest balkon albo loggia, choć parametr był odznaczony — scoring traktuje ofertę jak z balkonem.',
  ];
  const line = clientFacingWhyLine({ reasons: internal, city: 'Warszawa', district: 'Mokotów' });
  for (const reason of internal) assert.ok(!line.includes(reason.slice(0, 20)), line);
  assert.ok(!/brakowało/.test(line), 'balcony claim only when the client asked for it');

  const turn = buildOfferDialogueTurn({ reasons: internal, city: 'Warszawa', district: 'Mokotów' });
  assert.ok(!/kara|wyuczony|scoring/i.test(turn.body), turn.body);
});

test('balcony line appears when the client really missed a balcony', () => {
  const line = clientFacingWhyLine({ reasons: ['Ma balkon / loggię — tego wcześniej brakowało.'] });
  assert.match(line, /balkon/i);
});
