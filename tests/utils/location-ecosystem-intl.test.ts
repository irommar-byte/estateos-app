import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  countryFieldsFromGeocodedPlace,
  detectStrictCityFromGeocodeText,
  extractVillageLocalityFromStreet,
  getDraftLocationPresentation,
  hasValidMapCoordinates,
  isLocationStepComplete,
  localityNameFromGeocodedPlace,
  localityCountryIso,
  normalizeOfferLocationForApi,
  resolvePinLocationFromGeocodedPlace,
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
    assert.equal(hasValidMapCoordinates(29.76, -95.37), true);
  });

  it('map coordinates valid with negative latitude (Wheelers Hill, AU)', () => {
    assert.equal(hasValidMapCoordinates(-37.89, 145.07), true);
  });

  it('map coordinates valid in UK (London)', () => {
    assert.equal(hasValidMapCoordinates(51.507, -0.128), true);
  });

  it('countryFieldsFromGeocodedPlace uses isoCountryCode for Australia', () => {
    const fields = countryFieldsFromGeocodedPlace({
      isoCountryCode: 'AU',
      country: 'Australia',
    });
    assert.equal(fields.localityCountryCode, 'AU');
    assert.equal(fields.localityCountry, 'Australia');
  });

  it('localityCountryIso does not force PL when label is Australia', () => {
    assert.equal(localityCountryIso('PL', 'Australia'), 'AU');
  });

  it('step2 complete for Wheelers Hill with AU coords and street', () => {
    assert.equal(
      isLocationStepComplete({
        lat: -37.89,
        lng: 145.07,
        city: REST_OF_COUNTRY_CITY,
        district: 'Wheelers Hill',
        localityCountry: 'Australia',
        localityCountryCode: 'AU',
        street: '14 Ronston Ct',
      }),
      true,
    );
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

  it('normalizeOfferLocationForApi maps rest-of-country to real locality for API', () => {
    const api = normalizeOfferLocationForApi({
      city: REST_OF_COUNTRY_CITY,
      district: 'Raszyn',
      localityCountry: 'Polska',
      localityCountryCode: 'PL',
    });
    assert.equal(api.city, 'Raszyn');
    assert.equal(api.district, 'Inny obszar');
    assert.equal(api.localityCountryCode, 'PL');
  });

  it('does not treat multi-word street as village locality', () => {
    assert.equal(extractVillageLocalityFromStreet('Jana Kilińskiego 84'), '');
    assert.equal(extractVillageLocalityFromStreet('Jana Kilińskiego 84', 'Zamość'), '');
  });

  it('treats single-word settlement before number as village', () => {
    assert.equal(extractVillageLocalityFromStreet('Sitaniec 464'), 'Sitaniec');
  });

  it('ignores powiat/gmina in strict city detection', () => {
    assert.equal(detectStrictCityFromGeocodeText('Powiat zamojski'), null);
    assert.equal(detectStrictCityFromGeocodeText('Gmina Zamość'), null);
  });

  it('does not use street name as locality from geocoder name field', () => {
    assert.equal(
      localityNameFromGeocodedPlace({
        city: '',
        name: 'Jana Kilińskiego',
        street: 'Jana Kilińskiego',
        subregion: 'Powiat zamojski',
      }),
      'Ogólna',
    );
  });

  it('resolves Jana Kilińskiego in Zamość as strict city, not village', () => {
    const resolution = resolvePinLocationFromGeocodedPlace(
      {
        city: '',
        subregion: 'Zamość',
        name: 'Jana Kilińskiego',
        street: 'Jana Kilińskiego',
        district: 'Nowe Miasto',
        isoCountryCode: 'PL',
      },
      { streetHint: 'Jana Kilińskiego 84' },
    );
    assert.equal(resolution.mode, 'strict');
    if (resolution.mode === 'strict') {
      assert.equal(resolution.strictCity, 'Zamość');
    }
  });

  it('does not classify multi-word street as locality name', () => {
    const resolution = resolvePinLocationFromGeocodedPlace(
      {
        city: '',
        name: 'Jana Kilińskiego',
        street: 'Jana Kilińskiego',
        isoCountryCode: 'PL',
      },
      { streetHint: 'Jana Kilińskiego 84' },
    );
    if (resolution.mode === 'locality') {
      const districtNorm = resolution.district
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase();
      assert.notEqual(districtNorm, 'jana kilińskiego');
    }
  });

  it('resolves Sitaniec near Zamość as village locality', () => {
    const resolution = resolvePinLocationFromGeocodedPlace(
      {
        city: 'Sitaniec',
        name: 'Sitaniec',
        subregion: 'Powiat zamojski',
        isoCountryCode: 'PL',
      },
      { streetHint: 'Sitaniec 464' },
    );
    assert.equal(resolution.mode, 'locality');
    if (resolution.mode === 'locality') {
      assert.equal(resolution.city, REST_OF_COUNTRY_CITY);
      assert.equal(resolution.district, 'Sitaniec');
    }
  });
});
