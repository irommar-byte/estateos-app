import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCanonicalRadarPreferencesDto } from '../../src/contracts/parityContracts';
import { radarFiltersFromApiPreference } from '../../src/utils/radarPreferenceSync';
import type { RadarFilters } from '../../src/components/RadarCalibrationModal';

const defaults: RadarFilters = {
  calibrationMode: 'CITY',
  transactionType: 'SELL',
  propertyType: 'ALL',
  city: 'Warszawa',
  selectedDistricts: [],
  maxPrice: 0,
  minArea: 0,
  minYear: 1900,
  requireBalcony: false,
  requireGarden: false,
  requireElevator: false,
  requireParking: false,
  requireFurnished: false,
  requireTwoLevel: false,
  pushNotifications: true,
  matchThreshold: 70,
  favoritesNotifyPriceChange: true,
  favoritesNotifyDealProposals: true,
  favoritesNotifyIncludeAmounts: false,
  favoritesNotifyStatusChange: true,
  favoritesNotifyNewSimilar: true,
};

test('API preference hydrates MAP mode and amenities', () => {
  const { filters, mapBounds } = radarFiltersFromApiPreference(
    {
      transactionType: 'RENT',
      propertyType: 'FLAT',
      city: 'Kraków',
      selectedDistricts: ['Krowodrza'],
      maxPrice: 4500,
      minArea: 42,
      minYear: 2015,
      requireTwoLevel: true,
      minMatchThreshold: 82,
      lat: 50.06,
      lng: 19.94,
      radius: 4.2,
    },
    defaults,
  );
  assert.equal(filters.calibrationMode, 'MAP');
  assert.equal(filters.transactionType, 'RENT');
  assert.equal(filters.requireTwoLevel, true);
  assert.equal(filters.matchThreshold, 82);
  assert.deepEqual(mapBounds, { centerLat: 50.06, centerLng: 19.94, radiusKm: 4.2 });
});

test('canonical DTO omits map coords in CITY mode', () => {
  const dto = buildCanonicalRadarPreferencesDto({
    userId: 1,
    filters: { ...defaults, calibrationMode: 'CITY' },
    mapContext: { lat: 52.2, lng: 21.0, radius: 5 },
  });
  assert.equal(dto.lat, null);
  assert.equal(dto.lng, null);
  assert.equal(dto.radius, null);
});

test('canonical DTO includes map coords in MAP mode', () => {
  const dto = buildCanonicalRadarPreferencesDto({
    userId: 1,
    filters: { ...defaults, calibrationMode: 'MAP' },
    mapContext: { lat: 52.2, lng: 21.0, radius: 5 },
  });
  assert.equal(dto.lat, 52.2);
  assert.equal(dto.lng, 21);
  assert.equal(dto.radius, 5);
});
