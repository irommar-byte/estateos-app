import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyShowingKind, parseStartsAtList, showingStatusLabel } from '../src/lib/crm/showingKind';

test('own listing without import is own', () => {
  assert.equal(classifyShowingKind({ offerUserId: 10, agencyUserId: 10, hasImport: false }), 'own');
});

test('own listing with import snapshot is own_import', () => {
  assert.equal(classifyShowingKind({ offerUserId: 10, agencyUserId: 10, hasImport: true }), 'own_import');
});

test('someone else imported listing is external_import', () => {
  assert.equal(classifyShowingKind({ offerUserId: 55, agencyUserId: 10, hasImport: true }), 'external_import');
});

test('another EstateOS agent listing is other_agent', () => {
  assert.equal(classifyShowingKind({ offerUserId: 22, agencyUserId: 10, hasImport: false }), 'other_agent');
});

test('parseStartsAtList keeps one to three unique dates and accepts legacy startsAt', () => {
  const one = parseStartsAtList(undefined, '2026-09-20T10:00:00.000Z');
  assert.equal(one.length, 1);
  const many = parseStartsAtList([
    '2026-09-21T11:00:00.000Z',
    '2026-09-20T10:00:00.000Z',
    '2026-09-20T10:00:00.000Z',
    '2026-09-22T12:00:00.000Z',
    '2026-09-23T13:00:00.000Z',
  ]);
  assert.equal(many.length, 3);
  assert.equal(many[0].toISOString(), '2026-09-20T10:00:00.000Z');
});

test('import status stays at source contact until a slot is sent', () => {
  assert.equal(
    showingStatusLabel({ kind: 'own_import' }),
    'Kontakt ze źródłem',
  );
  assert.equal(
    showingStatusLabel({ kind: 'own_import', presentationStatus: 'pending' }),
    'Termin u kupującego',
  );
  assert.equal(showingStatusLabel({ kind: 'other_agent', listingRequestSent: true }), 'Wysłano prośbę');
  assert.equal(showingStatusLabel({ kind: 'own', held: true }), 'Odbyta');
});
