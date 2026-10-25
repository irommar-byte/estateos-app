import assert from 'node:assert/strict';
import test from 'node:test';
import { parseKeiNumeric, rowMatchesKeiFilters, type KeiListingRow } from '../src/lib/keiAmerClient';
import { districtMatches, extractWarsawDistrictFromKeiAddress, isWarsawAddress } from '../src/lib/keiAmerDistrict';
import { parseKeiRooms } from '../src/lib/keiAmerListingExtras';
import { decodeBytes, hasReplacementChars } from '../src/lib/http/decodeResponseText';
import { isWithinActiveHours, keiAutoErrorBackoffMinutes } from '../src/lib/keiAutoImportShared';

test('parseKeiNumeric handles Polish and international number formats', () => {
  assert.equal(parseKeiNumeric('1 250 000 zł'), 1_250_000);
  assert.equal(parseKeiNumeric('1,250,000'), 1_250_000);
  assert.equal(parseKeiNumeric('1.250.000'), 1_250_000);
  assert.equal(parseKeiNumeric('1 250 000,50 zł'), 1_250_000.5);
  assert.equal(parseKeiNumeric('62,5 m2'), 62.5);
  assert.equal(parseKeiNumeric('62.5'), 62.5);
  assert.equal(parseKeiNumeric('125,000'), 125_000);
  assert.equal(parseKeiNumeric(''), null);
  assert.equal(parseKeiNumeric('brak'), null);
});

test('district matching reads the address, not words in the description', () => {
  assert.equal(extractWarsawDistrictFromKeiAddress('warszawa, białołęka, żerań'), 'Białołęka');
  assert.ok(districtMatches('Białołęka', 'warszawa, białołęka, żerań'));
  assert.ok(!districtMatches('Ochota', 'warszawa, mokotów, służew'));
  assert.ok(!districtMatches('Wola', 'warszawa, ursynów'));
});

test('Warsaw is detected from the first address segment only', () => {
  assert.ok(isWarsawAddress('Warszawa, Mokotów'));
  assert.ok(!isWarsawAddress('Piaseczno, Zalesie Dolne'));
  assert.ok(!isWarsawAddress('Łomianki', 'blisko Warszawa Centralna'));
});

test('rooms parser ignores bare digits in the type field', () => {
  assert.equal(parseKeiRooms('3P'), 3);
  assert.equal(parseKeiRooms('2 pok.'), 2);
  assert.equal(parseKeiRooms('2'), null);
  assert.equal(parseKeiRooms('4', true), 4);
});

test('property kind only rejects explicit contradictions', () => {
  const row = (typ: string) => ({ rodzaj: '1', typ } as Pick<KeiListingRow, 'rodzaj' | 'typ'>);
  assert.ok(rowMatchesKeiFilters(row('3P'), 'house', 'sale'));
  assert.ok(rowMatchesKeiFilters(row('3P'), 'apartment', 'sale'));
  assert.ok(!rowMatchesKeiFilters(row('dom wolnostojący'), 'apartment', 'sale'));
  assert.ok(!rowMatchesKeiFilters({ rodzaj: '2', typ: '' } as Pick<KeiListingRow, 'rodzaj' | 'typ'>, 'apartment', 'sale'));
});

test('legacy Polish encodings decode to proper letters', () => {
  const win1250 = Uint8Array.from([0x42, 0x69, 0x61, 0xb3, 0x6f, 0xb3, 0xea, 0x6b, 0x61]); // Białołęka
  assert.equal(decodeBytes(win1250, 'text/html; charset=windows-1250'), 'Białołęka');
  assert.equal(decodeBytes(win1250, null), 'Białołęka');
  const iso2 = Uint8Array.from([0xbf, 0xf3, 0xb3, 0x77]); // żółw
  assert.equal(decodeBytes(iso2, 'text/html; charset=iso-8859-2'), 'żółw');
  const utf8 = new TextEncoder().encode('Łazienka');
  assert.equal(decodeBytes(utf8, 'text/html'), 'Łazienka');
  assert.ok(hasReplacementChars('Bia�o��ka'));
});

test('auto-import schedule helpers', () => {
  assert.equal(keiAutoErrorBackoffMinutes(0), 0);
  assert.equal(keiAutoErrorBackoffMinutes(1), 2);
  assert.equal(keiAutoErrorBackoffMinutes(9), 60);
  assert.ok(isWithinActiveHours({ activeFromHour: 0, activeToHour: 0 }));
});
