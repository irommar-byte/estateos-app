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

test('jednopoziomowe does not suggest duplex', () => {
  assert.equal(
    descriptionImpliesAmenity('Przestronne mieszkanie jednopoziomowe bez antresoli.', 'isDuplex'),
    false,
  );
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
