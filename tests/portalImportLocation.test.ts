import test from 'node:test';
import assert from 'node:assert/strict';
import { pickImportedListingCity, inferCityFromLocationHints } from '../src/lib/portalImportEnrich';

test('listing title Warszawa wins over leftover Białystok form city', () => {
  assert.equal(
    pickImportedListingCity({
      draftCity: 'Białystok',
      hintedCity: 'Warszawa',
      pinCity: 'Warszawa',
    }),
    'Warszawa',
  );
});

test('pin city overwrites a conflicting strict form city when listing text is empty', () => {
  assert.equal(
    pickImportedListingCity({
      draftCity: 'Białystok',
      hintedCity: '',
      pinCity: 'Warszawa',
    }),
    'Warszawa',
  );
});

test('hinted listing city wins even if the pin is still on the wrong town', () => {
  assert.equal(
    pickImportedListingCity({
      draftCity: 'Białystok',
      hintedCity: 'Warszawa',
      pinCity: 'Białystok',
    }),
    'Warszawa',
  );
});

test('title with Warszawa is inferred from location hints', () => {
  assert.equal(
    inferCityFromLocationHints('2 pokoje, 41 m² ul. Młynarska, Warszawa'),
    'Warszawa',
  );
});
