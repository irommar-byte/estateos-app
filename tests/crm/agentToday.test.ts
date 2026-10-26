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
  assert.equal(contact?.phone, '501 234 567');
  assert.equal(contact?.phoneSource, 'kei');
  assert.equal(contact?.advertiser, 'Właściciel prywatny');
  assert.equal(contact?.sourceLabel, 'Otodom');
  assert.equal(contact?.directOwner, true);
  assert.equal(contact?.note, 'Pan Marek, dzwonić po 17');
});

test('kontakt do właściciela: numer wyciągnięty z notatki agenta', () => {
  const contact = extractOwnerContact({ userNote: 'Właścicielka: 601-222-333, prosi o SMS', importSnapshotJson: null });
  assert.equal(contact?.phone, '601 222 333');
  assert.equal(contact?.phoneSource, 'note');
});

test('kontakt do właściciela: numer dopisany przez agenta wygrywa, zamaskowany nie jest numerem', () => {
  const agent = extractOwnerContact({
    importSnapshotJson: JSON.stringify({ contact: { agentPhone: '600100200', keiPhone: '501234567' } }),
  });
  assert.equal(agent?.phone, '600 100 200');
  assert.equal(agent?.phoneSource, 'agent');
  const masked = extractOwnerContact({
    importSnapshotJson: JSON.stringify({ contactHints: { phone: '601 222 ...', agencyName: 'Dom Plus' }, contact: { advertiserType: 'agency' } }),
  });
  assert.equal(masked?.phone, null);
  assert.equal(masked?.phoneMasked, '601 222 ...');
  assert.equal(masked?.advertiser, 'Biuro: Dom Plus');
});

test('kontakt do właściciela: numer z treści ogłoszenia', () => {
  const contact = extractOwnerContact({
    importSnapshotJson: JSON.stringify({ descriptionOriginalText: 'Zapraszam do kontaktu: tel. 512-345-678, bez pośredników.' }),
  });
  assert.equal(contact?.phone, '512 345 678');
  assert.equal(contact?.phoneSource, 'description');
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
