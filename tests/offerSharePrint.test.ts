import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOfferShareMapSrc,
  buildOfferShareQrSrc,
  formatOfferShareFloor,
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

test('JPEG filename uses the same slug with .jpg', () => {
  assert.equal(
    offerSharePrintFilename({ id: 1228, title: 'Komfortowe mieszkanie Wola' } as any, 'jpeg'),
    'estateos-oferta-1228-komfortowe-mieszkanie-wola.jpg',
  );
});

test('short description stays intact', () => {
  assert.equal(truncateOfferShareDescription('Krótki opis', 40), 'Krótki opis');
});

test('description stops on a complete sentence instead of mid-word', () => {
  const text =
    'Zapraszamy do oferty. Mieszkanie zapewnia doskonałe doświetlenie przez cały dzień. Dalej jest jeszcze więcej tekstu który nie powinien się urwać.';
  const out = truncateOfferShareDescription(text, 90);
  assert.equal(out, 'Zapraszamy do oferty. Mieszkanie zapewnia doskonałe doświetlenie przez cały dzień.');
  assert.doesNotMatch(out, /…$/);
});

test('floor zero prints as Parter', () => {
  assert.equal(formatOfferShareFloor(0), 'Parter');
  assert.equal(formatOfferShareFloor(3), '3');
});
