import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPeselDecode, parsePesel, polishAgePhrase } from '../src/lib/pesel';

test('decodes a 1977 male PESEL next to age in Polish', () => {
  const data = parsePesel('77030803059');
  assert.equal(data?.birthDate, '1977-03-08');
  assert.equal(data?.gender, 'M');
  assert.equal(formatPeselDecode('77030803059', new Date('2026-09-04T12:00:00Z')), 'Mężczyzna, 49 lat');
});

test('uses rok / lata / lat correctly', () => {
  assert.equal(polishAgePhrase(1), '1 rok');
  assert.equal(polishAgePhrase(2), '2 lata');
  assert.equal(polishAgePhrase(12), '12 lat');
  assert.equal(polishAgePhrase(22), '22 lata');
  assert.equal(polishAgePhrase(49), '49 lat');
});
