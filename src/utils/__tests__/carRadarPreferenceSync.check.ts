/**
 * Lightweight regression checks for car radar DTO ↔ filters mapping.
 * Run: npx tsx src/utils/__tests__/carRadarPreferenceSync.check.ts
 */
import assert from 'node:assert/strict';
import {
  buildCanonicalCarRadarPreferencesDto,
  carRadarFiltersFromApiPreference,
} from '../carRadarPreferenceSync';
import { EMPTY_CARS_ADVANCED_FILTERS } from '../carsAdvancedFilters';

function main() {
  const filters = {
    ...EMPTY_CARS_ADVANCED_FILTERS,
    make: 'BMW',
    model: 'M6',
    city: 'Warszawa',
    minPrice: '100000',
    maxPrice: '200000',
    minYear: '2014',
    maxYear: '2018',
    minMileage: '0',
    maxMileage: '150000',
    matchThreshold: 80,
    pushNotifications: true,
    mapBounds: { centerLat: 52.2, centerLng: 21.0, radiusKm: 40 },
  };

  const dto = buildCanonicalCarRadarPreferencesDto({
    userId: 42,
    filters,
    enabled: true,
    pushNotifications: true,
  });

  assert.equal(dto.userId, 42);
  assert.equal(dto.make, 'BMW');
  assert.equal(dto.model, 'M6');
  assert.equal(dto.city, 'Warszawa');
  assert.equal(dto.minPrice, 100000);
  assert.equal(dto.maxPrice, 200000);
  assert.equal(dto.minYear, 2014);
  assert.equal(dto.maxYear, 2018);
  assert.equal(dto.lat, 52.2);
  assert.equal(dto.lng, 21.0);
  assert.equal(dto.radius, 40);
  assert.equal(dto.enabled, true);
  assert.equal(dto.pushNotifications, true);
  assert.equal(dto.minMatchThreshold, 80);

  const roundTrip = carRadarFiltersFromApiPreference({
    ...dto,
    queryText: dto.queryText,
    minMatchThreshold: dto.minMatchThreshold,
  });

  assert.equal(roundTrip.make, 'BMW');
  assert.equal(roundTrip.model, 'M6');
  assert.equal(roundTrip.city, 'Warszawa');
  assert.equal(roundTrip.minPrice, '100000');
  assert.equal(roundTrip.matchThreshold, 80);
  assert.equal(roundTrip.pushNotifications, true);
  assert.ok(roundTrip.mapBounds);
  assert.equal(roundTrip.mapBounds?.radiusKm, 40);

  const disabledDto = buildCanonicalCarRadarPreferencesDto({
    userId: 42,
    filters: { ...filters, pushNotifications: false },
    enabled: false,
    pushNotifications: false,
  });
  assert.equal(disabledDto.enabled, false);
  assert.equal(disabledDto.pushNotifications, false);

  // threshold clamp
  const clamped = buildCanonicalCarRadarPreferencesDto({
    userId: 1,
    filters: { ...EMPTY_CARS_ADVANCED_FILTERS, matchThreshold: 120 },
    enabled: true,
  });
  assert.equal(clamped.minMatchThreshold, 100);

  console.log('carRadarPreferenceSync.check.ts: OK');
}

main();
