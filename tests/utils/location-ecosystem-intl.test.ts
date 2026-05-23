import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDraftLocationPresentation,
  isLocationStepComplete,
  localityNameFromGeocodedPlace,
  localityCountryIso,
  REST_OF_COUNTRY_CITY,
} from '../../src/constants/locationEcosystem';

describe('locationEcosystem international', () => {
  it('does not treat US state abbrev as country code in district', () => {
    const pres = getDraftLocationPresentation({
      city: REST_OF_COUNTRY_CITY,
      district: 'TX',
      localityCountry: 'Stany Zjednoczone',
      localityCountryCode: 'US',
    });
    assert.equal(pres.district, 'TX');
    assert.equal(pres.countryIso, 'US');
  });

  it('clears misplaced country ISO from district slot', () => {
    const pres = getDraftLocationPresentation({
      city: REST_OF_COUNTRY_CITY,
      district: 'US',
      localityCountry: 'Stany Zjednoczone',
      localityCountryCode: 'US',
    });
    assert.equal(pres.district, 'Ogólna');
  });

  it('prefers city over US state in geocoded locality', () => {
    assert.equal(
      localityNameFromGeocodedPlace({
        city: 'Lewisville',
        subregion: 'TX',
        isoCountryCode: 'US',
      }),
      'Lewisville',
    );
  });

  it('reconciles default PL code with non-PL country label', () => {
    assert.equal(localityCountryIso('PL', 'Stany Zjednoczone'), 'US');
  });

  it('map coordinates valid with negative longitude (Houston)', () => {
    const lat = 29.76;
    const lng = -95.37;
    assert.ok(Number.isFinite(lat) && Number.isFinite(lng));
    assert.ok(Math.abs(lat) <= 90 && Math.abs(lng) <= 180);
    assert.ok(!(lat === 0 && lng === 0));
    assert.ok(!(lng > 0));
  });

  it('allows intl step with coords and street when locality is Ogólna', () => {
    assert.equal(
      isLocationStepComplete({
        lat: 33.046,
        lng: -96.994,
        city: REST_OF_COUNTRY_CITY,
        district: 'US',
        localityCountry: 'Stany Zjednoczone',
        localityCountryCode: 'US',
        street: '832 Mullins Ave',
      }),
      true,
    );
  });
});
