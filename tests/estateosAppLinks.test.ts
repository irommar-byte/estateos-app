import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIosAppOpenUrl,
  extractOfferIdFromHref,
} from '../src/lib/estateosAppLinks';

test('extracts offer id from /oferta and Facebook query', () => {
  assert.equal(
    extractOfferIdFromHref('https://estateos.pl/oferta/1228?agent=55&fbclid=IwAR'),
    1228,
  );
  assert.equal(extractOfferIdFromHref('https://estateos.pl/o/1228'), 1228);
  assert.equal(extractOfferIdFromHref('/oferta/1733'), 1733);
  assert.equal(extractOfferIdFromHref('https://estateos.pl/mapa'), null);
  assert.equal(extractOfferIdFromHref('https://estateos.pl/oferty'), null);
});

test('iOS app URL deep-links the offer, portal, or launches the app', () => {
  assert.equal(buildIosAppOpenUrl(1228), 'estateos://o/1228');
  assert.equal(buildIosAppOpenUrl(null), 'estateos://');
  assert.equal(
    buildIosAppOpenUrl(null, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    'estateos://klient/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  );
});
