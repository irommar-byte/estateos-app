import test from 'node:test';
import assert from 'node:assert/strict';
import {
  descriptionImpliesAmenity,
  inferAmenitySuggestions,
  portalFeaturesIncludeAmenity,
  quotesForAmenity,
} from '../src/lib/intelligenceAmenityBrain';

test('loggia in description suggests balcony when portal did not check it', () => {
  const suggestions = inferAmenitySuggestions({
    features: ['winda', 'piwnica'],
    title: 'Mieszkanie Ursynów',
    description: 'Przestronny salon z dużą loggią od południa. Komórka lokatorska w piwnicy.',
  });
  const fields = suggestions.map((item) => item.field);
  assert.ok(fields.includes('hasBalcony'));
  assert.equal(fields.includes('hasStorage'), false);
  assert.equal(fields.includes('hasElevator'), false);
  const balcony = suggestions.find((item) => item.field === 'hasBalcony');
  assert.ok(balcony?.quotes.some((quote) => /loggią/i.test(quote)));
});

test('bez balkonu does not suggest balcony even if loggia appears in a negation-heavy text', () => {
  assert.equal(descriptionImpliesAmenity('Mieszkanie bez balkonu, z ogródkiem.', 'hasBalcony'), false);
  assert.equal(descriptionImpliesAmenity('Duża loggia od salonu.', 'hasBalcony'), true);
  const suggestions = inferAmenitySuggestions({
    features: [],
    description: 'Kawalerka bez balkonu i bez loggii, za to z ogródkiem.',
  });
  assert.equal(suggestions.some((item) => item.field === 'hasBalcony'), false);
  assert.ok(suggestions.some((item) => item.field === 'hasGarden'));
});

test('piwnica and komórka map to storage, garden and parking have their own quotes', () => {
  const text = 'Do mieszkania należy komórka lokatorska. Ogródek 40 m. Garaż podziemny w cenie.';
  assert.equal(descriptionImpliesAmenity(text, 'hasStorage'), true);
  assert.equal(descriptionImpliesAmenity(text, 'hasGarden'), true);
  assert.equal(descriptionImpliesAmenity(text, 'hasParking'), true);
  assert.ok(quotesForAmenity(text, 'hasGarden').some((quote) => /Ogródek/i.test(quote)));
});

test('duplex and furnished are inferred from description', () => {
  const text = 'Mieszkanie dwupoziomowe z antresolą, w pełni umeblowane.';
  assert.equal(descriptionImpliesAmenity(text, 'isDuplex'), true);
  assert.equal(descriptionImpliesAmenity(text, 'isFurnished'), true);
  const suggestions = inferAmenitySuggestions({
    features: [],
    description: text,
  });
  const fields = suggestions.map((item) => item.field);
  assert.ok(fields.includes('isDuplex'));
  assert.ok(fields.includes('isFurnished'));
});

test('long import description infers miejskie ogrzewanie', () => {
  const { inferHeatingFromImportText } = require('../src/lib/intelligenceAmenityBrain') as typeof import('../src/lib/intelligenceAmenityBrain');
  const text =
    'Mieszkanie na 3 piętrze budynku z 2017 roku, wyposażonego w windę. Salon z wyjściem na balkon. Mieszkanie jest dodatkowo wyposażone w klimatyzację. Do lokalu przynależy miejsce postojowe w garażu podziemnym.';
  assert.equal(inferHeatingFromImportText(`${text} Ogrzewanie miejskie z MCO.`), 'Miejskie');
});

test('otodom-like import preview marks balcony elevator parking and klima', () => {
  const { previewImportSmartAdd } = require('../src/lib/intelligenceAmenityBrain') as typeof import('../src/lib/intelligenceAmenityBrain');
  const preview = previewImportSmartAdd({
    source: 'OTODOM',
    externalId: 68357457,
    externalUrl: 'https://www.otodom.pl/pl/oferta/test',
    title: '39m, 2 pokoje, duży balkon, klima. Miejsce postojowe w cenie.',
    descriptionText:
      'Salon z aneksem kuchennym i wyjściem na balkon. Balkon - 8,05 m². Budynek wyposażony w windę. Miejsce postojowe w garażu podziemnym w cenie. Klimatyzacja.',
    descriptionHtml: '',
    features: [],
    transactionType: 'SELL',
    propertyType: 'FLAT',
    price: 500000,
    priceCurrency: 'PLN',
    area: 39,
    rooms: 2,
    city: 'Warszawa',
    district: 'Białołęka',
    lat: 52.3,
    lng: 21.0,
    imageUrls: [],
    heating: null,
    heatingCode: null,
  } as any);
  assert.equal(preview.amenities.hasBalcony, true);
  assert.equal(preview.amenities.hasElevator, true);
  assert.equal(preview.amenities.hasParking, true);
  assert.equal(preview.amenities.hasAirConditioning, true);
});

test('klimatyzacja and miejskie ogrzewanie are inferred from import text', () => {
  const text = 'Mieszkanie z klimatyzacją i ogrzewaniem miejskim.';
  assert.equal(descriptionImpliesAmenity(text, 'hasAirConditioning'), true);
  const { inferHeatingFromImportText, previewImportSmartAdd } = require('../src/lib/intelligenceAmenityBrain') as typeof import('../src/lib/intelligenceAmenityBrain');
  assert.equal(inferHeatingFromImportText(text), 'Miejskie');
  const preview = previewImportSmartAdd({
    source: 'OTODOM',
    externalId: 1,
    externalUrl: 'https://www.otodom.pl/pl/oferta/test',
    title: 'Mieszkanie z balkonem',
    descriptionText: 'Duży balkon, winda, miejsce postojowe, klimatyzacja, ogrzewanie miejskie, umeblowane.',
    descriptionHtml: '',
    features: [],
    transactionType: 'SELL',
    propertyType: 'FLAT',
    price: 500000,
    priceCurrency: 'PLN',
    area: 40,
    rooms: 2,
    city: 'Warszawa',
    district: 'Mokotów',
    lat: 52.2,
    lng: 21.0,
    imageUrls: [],
    heating: null,
    heatingCode: null,
  } as any);
  assert.equal(preview.amenities.hasBalcony, true);
  assert.equal(preview.amenities.hasElevator, true);
  assert.equal(preview.amenities.hasParking, true);
  assert.equal(preview.amenities.hasAirConditioning, true);
  assert.equal(preview.amenities.isFurnished, true);
  assert.equal(preview.heating, 'Miejskie');
});

test('jednopoziomowe does not suggest duplex', () => {
  assert.equal(
    descriptionImpliesAmenity('Przestronne mieszkanie jednopoziomowe bez antresoli.', 'isDuplex'),
    false,
  );
});

test('parseAmenityPatchMap accepts JSON string from mysql raw query', () => {
  const { parseAmenityPatchMap } = require('../src/lib/intelligenceAmenityBrain') as typeof import('../src/lib/intelligenceAmenityBrain');
  const map = parseAmenityPatchMap(
    JSON.stringify({
      hasBalcony: {
        field: 'hasBalcony',
        label: 'Balkon / loggia',
        status: 'applied',
        quote: 'Duży balkon od salonu.',
        quotes: ['Duży balkon od salonu.'],
        source: 'import',
        appliedAt: '2026-08-27T18:52:50.160Z',
      },
    }),
  );
  assert.equal(map.hasBalcony?.status, 'applied');
});

test('already checked portal features are not suggested again', () => {
  assert.equal(portalFeaturesIncludeAmenity(['loggia'], 'hasBalcony'), true);
  assert.equal(portalFeaturesIncludeAmenity(['taras'], 'hasBalcony'), true);
  assert.equal(portalFeaturesIncludeAmenity(['balkon', 'taras'], 'hasBalcony'), true);
  const suggestions = inferAmenitySuggestions({
    features: ['balkon'],
    description: 'Loggia i balkon od salonu.',
    alreadyOn: { hasBalcony: true },
  });
  assert.equal(suggestions.some((item) => item.field === 'hasBalcony'), false);
});
