import assert from 'node:assert/strict';
import test from 'node:test';
import {
  explicitCityInText,
  inferCityFromImportSlug,
  inferCityFromLocationHints,
  listingCityFromDraftText,
  pickImportedListingCity,
} from '../src/lib/portalImportEnrich';
import { pickDistrictFromPlaceName } from '../src/lib/location/locationCatalog';

test('generic words in the description never turn Warsaw into Białystok', () => {
  assert.equal(inferCityFromLocationHints('Mieszkanie dla młodych, blisko centrum, ul. Sienkiewicza'), '');
  assert.equal(
    listingCityFromDraftText({
      title: 'Słoneczne 2 pokoje z balkonem',
      street: null as unknown as string,
      externalUrl: 'https://www.otodom.pl/pl/oferta/sloneczne-2-pokoje-ID4abc',
      descriptionText: 'Idealne dla młodych, blisko centrum i Piasków.',
    }),
    '',
  );
  // Bez pewnej podpowiedzi z treści decyduje portal (i pinezka).
  assert.equal(pickImportedListingCity({ draftCity: 'Warszawa', hintedCity: '', pinCity: 'Warszawa' }), 'Warszawa');
});

test('explicit city names are read in location forms only', () => {
  assert.equal(explicitCityInText('Piękne mieszkanie w Białymstoku'), 'Białystok');
  assert.equal(explicitCityInText('Warszawa, Mokotów, Służew'), 'Warszawa');
  assert.equal(explicitCityInText('Dom 20 minut do Warszawy'), '');
  assert.equal(explicitCityInText('ul. Warszawska 12'), '');
  assert.equal(explicitCityInText('Warszawa lub Kraków'), '');
});

test('distinctive district names still identify the city', () => {
  assert.equal(inferCityFromLocationHints('3 pokoje, Mokotów'), 'Warszawa');
  assert.equal(inferCityFromLocationHints('Kawalerka Białołęka'), 'Warszawa');
  assert.equal(inferCityFromImportSlug('https://www.otodom.pl/pl/oferta/mieszkanie-warszawa-wola-ID1', ''), 'Warszawa');
});

test('district matching uses whole words and prefers longer names', () => {
  assert.equal(pickDistrictFromPlaceName('Warszawa', 'wolne od zaraz, blisko metra'), '');
  assert.equal(pickDistrictFromPlaceName('Warszawa', 'Praga-Południe, Gocław'), 'Praga-Południe');
  assert.equal(pickDistrictFromPlaceName('Warszawa', 'Mieszkanie na Woli'), '');
  assert.equal(pickDistrictFromPlaceName('Warszawa', 'Warszawa, Wola, Mirów'), 'Wola');
});

test('pin wins over a conflicting portal label; an explicit title city wins over both', () => {
  assert.equal(pickImportedListingCity({ draftCity: 'Białystok', hintedCity: '', pinCity: 'Warszawa' }), 'Warszawa');
  assert.equal(pickImportedListingCity({ draftCity: 'Białystok', hintedCity: 'Warszawa', pinCity: 'Białystok' }), 'Warszawa');
  assert.equal(pickImportedListingCity({ draftCity: '', hintedCity: 'Kraków', pinCity: '' }), 'Kraków');
});
