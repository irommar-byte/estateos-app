import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  countryFieldsFromGeocodedPlace,
  detectStrictCityFromGeocodeText,
  extractVillageLocalityFromStreet,
  getDraftLocationPresentation,
  hasValidMapCoordinates,
  isLocationStepComplete,
  isVillageStyleAddress,
  isStandaloneVillageAddress,
  localityNameFromGeocodedPlace,
  localityCountryIso,
  normalizeOfferLocationForApi,
  pinMatchesStrictCity,
  resolvePinLocationFromGeocodedPlace,
  detectStrictCityFromCoordinates,
  isPinWithinStrictCityEnvelope,
  preserveVillageStreetHint,
  offerMatchesCityFilter,
  offerListingCountryIso,
  getLocationDraftRepairPatch,
  REST_OF_COUNTRY_CITY,
} from '../../src/constants/locationEcosystem';

function normLoc(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

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

  it('treats single-word settlement before number as village locality', () => {
    assert.equal(extractVillageLocalityFromStreet('Sitaniec 464'), 'Sitaniec');
  });

  it('ignores powiat/gmina in strict city detection', () => {
    assert.equal(detectStrictCityFromGeocodeText('Powiat zamojski'), null);
    assert.equal(detectStrictCityFromGeocodeText('Gmina Zamość'), null);
  });

  it('does not use street name as locality from geocoder city field', () => {
    assert.equal(
      localityNameFromGeocodedPlace(
        {
          city: 'Szwedzka',
          subregion: 'Warszawa',
          street: 'J Ordona',
          isoCountryCode: 'PL',
        },
        { streetHint: 'J Ordona 3' },
      ),
      'Warszawa',
    );
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

  it('resolves Sitaniec near Zamość as village locality, not Karolówka district', () => {
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

  it('does not treat Zamość street number in another city as village address', () => {
    assert.equal(isStandaloneVillageAddress('Zamość 13', 'Zamość'), false);
    assert.equal(isStandaloneVillageAddress('Sitaniec 464', 'Sitaniec'), true);
  });

  it('does not assign Topolowa as locality when Zamość and district are known', () => {
    const resolution = resolvePinLocationFromGeocodedPlace(
      {
        city: 'Zamość',
        street: 'Topolowa',
        district: 'Stare Miasto',
        isoCountryCode: 'PL',
      },
      { streetHint: 'Topolowa 5' },
    );
    assert.equal(resolution.mode, 'strict');
    if (resolution.mode === 'strict') {
      assert.equal(resolution.strictCity, 'Zamość');
    }
  });

  it('does not assign Zamość Karolówka when geocoder mislabels Sitaniec village', () => {
    const resolution = resolvePinLocationFromGeocodedPlace(
      {
        city: 'Zamość',
        district: 'Karolówka',
        name: 'Sitaniec',
        street: 'Sitaniec',
        isoCountryCode: 'PL',
      },
      { streetHint: 'Sitaniec 464' },
    );
    assert.equal(resolution.mode, 'locality');
    if (resolution.mode === 'locality') {
      assert.equal(resolution.district, 'Sitaniec');
      assert.equal(resolution.city, REST_OF_COUNTRY_CITY);
    }
  });

  it('resolves Sitaniec when geocoder returns Zamość with street field Sitaniec', () => {
    const resolution = resolvePinLocationFromGeocodedPlace(
      {
        city: 'Zamość',
        district: 'Karolówka',
        street: 'Sitaniec',
        isoCountryCode: 'PL',
      },
      { streetHint: 'Sitaniec 454' },
    );
    assert.equal(resolution.mode, 'locality');
    if (resolution.mode === 'locality') {
      assert.equal(resolution.district, 'Sitaniec');
      assert.equal(resolution.city, REST_OF_COUNTRY_CITY);
    }
  });

  it('keeps Zamość when geocoder returns osiedle name inside city envelope', () => {
    const lat = 50.718;
    const lng = 23.248;
    assert.equal(isPinWithinStrictCityEnvelope('Zamość', lat, lng), true);
    assert.equal(detectStrictCityFromCoordinates(lat, lng), 'Zamość');
    const resolution = resolvePinLocationFromGeocodedPlace(
      {
        city: 'Altanowa',
        district: 'Altanowa',
        isoCountryCode: 'PL',
      },
      { streetHint: 'A Asnyka 17', lat, lng, anchorStrictCity: 'Zamość' },
    );
    assert.equal(resolution.mode, 'strict');
    if (resolution.mode === 'strict') {
      assert.equal(resolution.strictCity, 'Zamość');
    }
  });

  it('Sitaniec stays village when outside Zamość envelope', () => {
    const lat = 50.7447;
    const lng = 23.1798;
    assert.equal(isPinWithinStrictCityEnvelope('Zamość', lat, lng), false);
    const resolution = resolvePinLocationFromGeocodedPlace(
      {
        city: 'Zamość',
        district: 'Karolówka',
        street: 'Sitaniec',
        isoCountryCode: 'PL',
      },
      { streetHint: 'Sitaniec 454', lat, lng },
    );
    assert.equal(resolution.mode, 'locality');
    if (resolution.mode === 'locality') {
      assert.equal(resolution.district, 'Sitaniec');
    }
  });

  it('preserveVillageStreetHint keeps house number when geocoder strips it', () => {
    assert.equal(preserveVillageStreetHint('Sitaniec 454', 'Sitaniec'), 'Sitaniec 454');
    assert.equal(preserveVillageStreetHint('Topolowa 5', 'Topolowa 5'), 'Topolowa 5');
  });

  it('pinMatchesStrictCity rejects Sitaniec pin with wrong Karolówka district', () => {
    assert.equal(pinMatchesStrictCity('Zamość', 'Sitaniec', 'Karolówka'), false);
  });

  it('does not treat Topolowa 5 in Zamość as village when geocoder mislabels street as city', () => {
    const resolution = resolvePinLocationFromGeocodedPlace(
      {
        city: 'Topolowa',
        street: 'Topolowa',
        isoCountryCode: 'PL',
      },
      { streetHint: 'Topolowa 5' },
    );
    if (resolution.mode === 'locality') {
      assert.notEqual(
        resolution.district
          .normalize('NFD')
          .replace(/\p{M}/gu, '')
          .toLowerCase(),
        'topolowa',
      );
    }
  });

  it('resolves Topolowa 5A in Zamość as strict city with district', () => {
    const resolution = resolvePinLocationFromGeocodedPlace(
      {
        city: 'Zamość',
        street: 'Topolowa',
        district: 'Stare Miasto',
        isoCountryCode: 'PL',
      },
      { streetHint: 'Topolowa 5A' },
    );
    assert.equal(resolution.mode, 'strict');
    if (resolution.mode === 'strict') {
      assert.equal(resolution.strictCity, 'Zamość');
    }
  });

  it('Warsaw pin with street mislabeled as city stays Warszawa (Radzymińska area)', () => {
    const lat = 52.2742;
    const lng = 21.0523;
    const resolution = resolvePinLocationFromGeocodedPlace(
      {
        city: 'Łochowska',
        street: 'Radzymińska',
        subregion: 'Warszawa',
        isoCountryCode: 'PL',
      },
      { streetHint: 'Radzymińska 52A', lat, lng },
    );
    assert.equal(resolution.mode, 'strict');
    if (resolution.mode === 'strict') {
      assert.equal(resolution.strictCity, 'Warszawa');
    }
  });

  it('Pruszków pin is not classified as Warszawa (Wiśniowa area)', () => {
    const lat = 52.1617;
    const lng = 20.8101;
    const resolution = resolvePinLocationFromGeocodedPlace(
      {
        city: 'Pruszków',
        street: 'Wiśniowa',
        district: 'Ursus',
        subregion: 'Pruszków',
        isoCountryCode: 'PL',
      },
      { streetHint: 'Wiśniowa 79', lat, lng },
    );
    assert.equal(resolution.mode, 'locality');
    if (resolution.mode === 'locality') {
      assert.equal(resolution.city, REST_OF_COUNTRY_CITY);
      assert.equal(normLoc(resolution.district), normLoc('Pruszków'));
    }
  });

  it('Pruszków pin with wrong geocoder Warszawa/Ursus still resolves to Pruszków', () => {
    const lat = 52.1617;
    const lng = 20.8101;
    const resolution = resolvePinLocationFromGeocodedPlace(
      {
        city: 'Warszawa',
        street: 'Wiśniowa',
        district: 'Ursus',
        subregion: 'Warszawa',
        isoCountryCode: 'PL',
      },
      { streetHint: 'Wiśniowa 79', lat, lng },
    );
    assert.equal(resolution.mode, 'locality');
    if (resolution.mode === 'locality') {
      assert.equal(resolution.city, REST_OF_COUNTRY_CITY);
      assert.equal(normLoc(resolution.district), normLoc('Pruszków'));
    }
  });

  it('Grodzisk Mazowiecki pin uses geocoder locality, not overlapping Milanówek satellite circle', () => {
    const lat = 52.104;
    const lng = 20.629;
    const resolution = resolvePinLocationFromGeocodedPlace(
      {
        city: 'Grodzisk Mazowiecki',
        street: 'Cicha',
        name: 'Cicha 7',
        isoCountryCode: 'PL',
      },
      { streetHint: 'Cicha 7', lat, lng },
    );
    assert.equal(resolution.mode, 'locality');
    if (resolution.mode === 'locality') {
      assert.equal(resolution.city, REST_OF_COUNTRY_CITY);
      assert.equal(normLoc(resolution.district), normLoc('Grodzisk Mazowiecki'));
    }
    assert.equal(
      normLoc(
        localityNameFromGeocodedPlace(
          { city: 'Grodzisk Mazowiecki', street: 'Cicha', isoCountryCode: 'PL' },
          { streetHint: 'Cicha 7', lat, lng },
        ),
      ),
      normLoc('Grodzisk Mazowiecki'),
    );
  });

  it('repair patch fixes Warszawa/Ursus to Pruszków when pin is in Pruszków', () => {
    const patch = getLocationDraftRepairPatch(
      {
        city: 'Warszawa',
        district: 'Ursus',
        localityCountry: 'Polska',
        localityCountryCode: 'PL',
      },
      { lat: 52.1617, lng: 20.8101 },
    );
    assert.ok(patch);
    assert.equal(patch?.city, REST_OF_COUNTRY_CITY);
    assert.equal(normLoc(patch?.district ?? ''), normLoc('Pruszków'));
  });

  it('repair patch does not demote Warszawa to Reszta when district is street name', () => {
    const patch = getLocationDraftRepairPatch(
      {
        city: 'Warszawa',
        district: 'Łochowska',
        localityCountry: 'Polska',
        localityCountryCode: 'PL',
      },
      { lat: 52.2742, lng: 21.0523 },
    );
    assert.ok(patch);
    assert.equal(patch?.city, 'Warszawa');
    assert.notEqual(patch?.city, REST_OF_COUNTRY_CITY);
  });

  it('city filter matches only exact metro — not Rest of country bucket', () => {
    assert.equal(
      offerMatchesCityFilter(
        { city: 'Raszyn', localityCountryCode: 'PL', localityCountry: 'Polska' },
        REST_OF_COUNTRY_CITY,
      ),
      false,
    );
    assert.equal(
      offerMatchesCityFilter(
        { city: 'Warszawa', localityCountryCode: 'PL', localityCountry: 'Polska' },
        'Warszawa',
      ),
      true,
    );
  });

  it('Berlin listing resolves to DE from coordinates even without localityCountry in API', () => {
    assert.equal(
      offerListingCountryIso({
        city: 'Berlin',
        lat: 52.52,
        lng: 13.405,
      }),
      'DE',
    );
    assert.equal(
      offerListingCountryIso({
        city: 'Berlin',
        localityCountryCode: 'PL',
        localityCountry: 'Polska',
        lat: 52.52,
        lng: 13.405,
      }),
      'DE',
    );
  });

  it('Warsaw listing stays PL from coordinates', () => {
    assert.equal(
      offerListingCountryIso({
        city: 'Warszawa',
        lat: 52.2297,
        lng: 21.0122,
      }),
      'PL',
    );
  });
});
