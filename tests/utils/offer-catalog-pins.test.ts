import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRadarPinList,
  mapRawOfferForRadar,
  normalizeLoginErrorMessage,
  parseOfferList,
} from '../../src/utils/offerCatalogPipeline';

test('parseOfferList accepts mobile success envelope', () => {
  const list = parseOfferList({ success: true, offers: [{ id: 1, lat: 52.1, lng: 21.0 }] });
  assert.equal(list?.length, 1);
});

test('mapRawOfferForRadar rejects missing coordinates', () => {
  assert.equal(mapRawOfferForRadar({ id: 1 }), null);
  assert.deepEqual(mapRawOfferForRadar({ id: 2, lat: 52.2, lng: 21.1 }), { id: 2, lat: 52.2, lng: 21.1 });
});

test('buildRadarPinList skips closed offers', () => {
  const pins = buildRadarPinList([
    { id: 1, lat: 52, lng: 21, status: 'ACTIVE' },
    { id: 2, lat: 52.1, lng: 21.1, status: 'SOLD' },
    { id: 3, lat: 'bad', lng: 21.2, status: 'ACTIVE' },
  ]);
  assert.deepEqual(pins, [{ id: 1, lat: 52, lng: 21 }]);
});

test('normalizeLoginErrorMessage maps network vs credentials', () => {
  assert.match(normalizeLoginErrorMessage('Network request failed'), /Brak połączenia/);
  assert.match(normalizeLoginErrorMessage('Nieprawidłowy e-mail lub hasło.'), /Nieprawidłowy e-mail/);
});
