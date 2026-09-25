import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOtodomLeadEmail } from '../../src/lib/crm/parseOtodomLeadEmail';

test('parseOtodomLeadEmail uses Numer w biurze not portal ID', () => {
  const raw = `
Andrzej Pieniak
andrzej.pieniak@gmail.com
+48 792 805 817
[Chcę umówić wizytę] To mieszkanie na sprzedaż wydaje mi się interesujące.
Numer w biurze: 1228
ID: 68374571
otodom.pl
`;
  const parsed = parseOtodomLeadEmail(raw);
  assert.equal(parsed.officeOfferId, 1228);
  assert.equal(parsed.portalListingId, '68374571');
  assert.equal(parsed.email, 'andrzej.pieniak@gmail.com');
  assert.ok(parsed.phone?.includes('792'));
  assert.equal(parsed.source, 'otodom');
});
