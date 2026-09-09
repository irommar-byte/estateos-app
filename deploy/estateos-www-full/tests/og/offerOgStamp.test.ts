import test from 'node:test';
import assert from 'node:assert/strict';
import {
  offerOgContentStamp,
  offerOgImagePath,
  carOgImagePath,
} from '../../src/lib/ogCardVersion';

test('og image path changes after a price edit so Facebook does not reuse the old card', () => {
  const before = offerOgContentStamp({
    pricePln: 975000,
    updatedAt: '2026-09-01T10:00:00.000Z',
    title: 'Komfortowe 3 pokoje',
  });
  const after = offerOgContentStamp({
    pricePln: 949000,
    updatedAt: '2026-09-09T06:00:00.000Z',
    title: 'Komfortowe 3 pokoje',
  });
  assert.notEqual(before, after);
  assert.match(before, /p975000/);
  assert.match(after, /p949000/);
  assert.notEqual(offerOgImagePath(1228, before), offerOgImagePath(1228, after));
  assert.match(offerOgImagePath(1228, after), /\/api\/og\/offer\/1228\/v8-p949000-t/);
});

test('og stamp also changes when only the title changes', () => {
  const at = '2026-09-09T06:00:00.000Z';
  const before = offerOgContentStamp({ pricePln: 975000, updatedAt: at, title: 'Stary tytuł' });
  const after = offerOgContentStamp({ pricePln: 975000, updatedAt: at, title: 'Nowy tytuł' });
  assert.notEqual(before, after);
});

test('car og image path also includes the content stamp', () => {
  const stamp = offerOgContentStamp({ pricePln: 89000, updatedAt: 1_700_000_000_000 });
  assert.match(carOgImagePath(12, stamp), /\/api\/og\/car\/12\/v8-p89000-t/);
});
