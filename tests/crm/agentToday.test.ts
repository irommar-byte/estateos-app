import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractOwnerContact } from '@/lib/crm/ownerContact';
import { nextOwnerCallAttempt } from '@/lib/crm/intelligenceSchedule';

test('kontakt do właściciela: telefon z importu KEI ma pierwszeństwo', () => {
  const contact = extractOwnerContact({
    userNote: 'Pan Marek, dzwonić po 17',
    importSnapshotJson: JSON.stringify({ contact: { keiPhone: '+48 501 234 567', directOwner: true } }),
    importExternalUrl: 'https://www.otodom.pl/pl/oferta/x',
  });
  assert.equal(contact?.phone, '+48 501 234 567');
  assert.equal(contact?.directOwner, true);
  assert.equal(contact?.note, 'Pan Marek, dzwonić po 17');
});

test('kontakt do właściciela: numer wyciągnięty z notatki agenta', () => {
  const contact = extractOwnerContact({ userNote: 'Właścicielka: 601-222-333, prosi o SMS', importSnapshotJson: null });
  assert.equal(contact?.phone, '601-222-333');
});

test('kontakt do właściciela: brak danych = null', () => {
  assert.equal(extractOwnerContact({ userNote: '', importSnapshotJson: '{}' }), null);
  assert.equal(extractOwnerContact(null), null);
});

test('„nie odbiera”: w ciągu dnia za 3 godziny, wieczorem jutro o 9:00', () => {
  // 10:00 w Warszawie (UTC+2) → 13:00
  assert.equal(nextOwnerCallAttempt(new Date('2026-10-23T08:00:00Z')).toISOString(), '2026-10-23T11:00:00.000Z');
  // 18:30 w Warszawie → jutro 9:00 (07:00 UTC)
  assert.equal(nextOwnerCallAttempt(new Date('2026-10-23T16:30:00Z')).toISOString(), '2026-10-24T07:00:00.000Z');
});
