import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOfferShareMapSrc,
  buildOfferShareQrSrc,
  offerSharePrintFilename,
  truncateOfferShareDescription,
} from '../src/lib/offerSharePrint';

test('QR is same-origin so html2canvas can snapshot the brochure', () => {
  const src = buildOfferShareQrSrc('https://estateos.pl/o/1228', 220);
  assert.match(src, /^\/api\/qr\?size=220&data=/);
  assert.doesNotMatch(src, /qrserver/);
});

test('map preview is same-origin with lat/lng', () => {
  assert.equal(
    buildOfferShareMapSrc(52.2297, 21.0122),
    '/api/map/static?lat=52.2297&lng=21.0122',
  );
});

test('PDF filename is a stable slug', () => {
  assert.equal(
    offerSharePrintFilename({ id: 1228, title: 'Komfortowe mieszkanie Wola' } as any),
    'estateos-oferta-1228-komfortowe-mieszkanie-wola.pdf',
  );
});

test('description is truncated with an ellipsis', () => {
  assert.equal(truncateOfferShareDescription('Krótki opis', 40), 'Krótki opis');
  assert.equal(truncateOfferShareDescription('x'.repeat(80), 20).length, 20);
  assert.match(truncateOfferShareDescription('x'.repeat(80), 20), /…$/);
});
