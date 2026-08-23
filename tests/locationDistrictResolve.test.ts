import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inferDistrictFromStreet,
  preferStreetOrOsiedleDistrict,
  resolveCanonicalOfferDistrict,
} from '../src/lib/location/locationCatalog';

test('ul. Książkowa maps to Białołęka, not the Bielany centroid', () => {
  assert.equal(inferDistrictFromStreet('Warszawa', 'ul. Książkowa 12'), 'Białołęka');
  assert.equal(inferDistrictFromStreet('Warszawa', 'Książkowa'), 'Białołęka');
  assert.equal(
    preferStreetOrOsiedleDistrict('Warszawa', { street: 'Książkowa 8', neighborhood: 'Bielany' }),
    'Białołęka',
  );
});

test('Nowodwory in the title beats a wrong Bielany portal label', () => {
  assert.equal(
    preferStreetOrOsiedleDistrict('Warszawa', {
      neighborhood: 'Nowodwory',
      title: 'Mieszkanie Nowodwory',
    }),
    'Białołęka',
  );
  assert.equal(
    resolveCanonicalOfferDistrict('Warszawa', {
      district: 'Bielany',
      street: 'Książkowa 4',
      title: 'Kawalerka na Nowodworach',
    }),
    'Białołęka',
  );
});

test('Chomiczówka is not stolen by Bemowo chomicza', () => {
  assert.equal(inferDistrictFromStreet('Warszawa', 'Chomiczówka 10'), '');
});
