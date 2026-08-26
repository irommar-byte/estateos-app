import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNierOnlineSearchFallbackUrl,
  buildNierOnlineSearchUrl,
  isNierOnlineListingUrl,
  listingMatchesClientFilters,
  parseNierOnlineSearchHtml,
  slugifyNierOnlineCity,
} from '../src/lib/nieruchomosciOnlineSearch';

test('city slug strips diacritics and spaces', () => {
  assert.equal(slugifyNierOnlineCity('Warszawa'), 'warszawa');
  assert.equal(slugifyNierOnlineCity('Kraków'), 'krakow');
  assert.equal(slugifyNierOnlineCity('Jelenia Góra'), 'jelenia-gora');
});

test('search URL uses city subdomain and listing path', () => {
  assert.equal(
    buildNierOnlineSearchUrl({ city: 'Warszawa', propertyType: 'FLAT', transactionType: 'SELL' }),
    'https://warszawa.nieruchomosci-online.pl/mieszkania,sprzedaz/',
  );
  assert.equal(
    buildNierOnlineSearchUrl({ city: 'Kraków', propertyType: 'HOUSE', transactionType: 'RENT' }, 2),
    'https://krakow.nieruchomosci-online.pl/domy,wynajem/?p=2',
  );
  assert.match(
    buildNierOnlineSearchFallbackUrl({ city: 'Warszawa', propertyType: 'FLAT', transactionType: 'SELL' }),
    /szukaj\.html\?3,mieszkanie,sprzedaz,,Warszawa/,
  );
});

test('listing URL detector accepts offer pages only', () => {
  assert.equal(
    isNierOnlineListingUrl('https://warszawa.nieruchomosci-online.pl/mieszkanie,na-sprzedaz/26904107.html'),
    true,
  );
  assert.equal(
    isNierOnlineListingUrl('https://warszawa.nieruchomosci-online.pl/mieszkania,sprzedaz/'),
    false,
  );
});

const SAMPLE_HTML = `
<script type="application/ld+json">
{"@type":"CollectionPage","mainEntity":{"@type":"Product","offers":[{"@type":"AggregateOffer","offers":[
  {"@type":"Offer","price":"720000","url":"https://warszawa.nieruchomosci-online.pl/mieszkanie,na-sprzedaz/26904107.html","name":"Sprzedam Mieszkanie Warszawa - 39,50 m²","itemOffered":{"@type":"Accommodation","description":"2 pokoje Wola balkon winda miejsce postojowe","address":{"streetAddress":"Pereca","addressLocality":"Warszawa"},"floorSize":{"value":"39.50"},"numberOfRooms":2}},
  {"@type":"Offer","price":"2050000","url":"https://warszawa.nieruchomosci-online.pl/mieszkanie,z-kuchnia-z-oknem/25935884.html","name":"Sprzedam Mieszkanie Warszawa - 105 m²","itemOffered":{"@type":"Accommodation","description":"Wilanów ogród","address":{"streetAddress":"Bruzdowa","addressLocality":"Warszawa"},"floorSize":{"value":"105.49"},"numberOfRooms":3}},
  {"@type":"Offer","price":"650000","url":"https://zabki.nieruchomosci-online.pl/nowe-mieszkanie,powstancow-residence/25751958.html","name":"Sprzedam Mieszkanie Ząbki - 48 m²","itemOffered":{"@type":"Accommodation","description":"Ząbki balkon","address":{"streetAddress":"Powstańców","addressLocality":"Ząbki"},"floorSize":{"value":"48.62"},"numberOfRooms":2}}
]}]}}
</script>
`;

test('JSON-LD search parser extracts listing cards', () => {
  const hits = parseNierOnlineSearchHtml(SAMPLE_HTML);
  assert.equal(hits.length, 3);
  assert.equal(hits[0].price, 720000);
  assert.equal(hits[0].area, 39.5);
  assert.equal(hits[0].rooms, 2);
  assert.equal(hits[0].city, 'Warszawa');
});

test('client filters keep matching N-O hits and drop suburbs / over-budget', () => {
  const hits = parseNierOnlineSearchHtml(SAMPLE_HTML);
  const filters = {
    city: 'Warszawa',
    districts: ['Wola'],
    maxPrice: 800000,
    minArea: 30,
    requireBalcony: true,
    requireParking: true,
  };
  const matched = hits.filter((hit) => listingMatchesClientFilters(hit, filters));
  assert.equal(matched.length, 1);
  assert.match(matched[0].url, /26904107/);
});
