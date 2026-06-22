import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterOffersInMapRegion,
  isCoordinateInMapRegion,
  mergeSelectedOfferIntoMapPins,
  capMapPinsNearCenter,
  shouldShowMapPrivacyCircles,
} from '../../src/utils/radarMapViewport';

describe('radarMapViewport', () => {
  const region = {
    latitude: 52.23,
    longitude: 21.01,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };

  it('filters offers outside expanded viewport', () => {
    const offers = [
      { id: 1, lat: 52.23, lng: 21.01 },
      { id: 2, lat: 50.0, lng: 19.0 },
    ];
    const filtered = filterOffersInMapRegion(offers, region);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, 1);
  });

  it('keeps selected offer even when off-screen', () => {
    const offers = [{ id: 1, lat: 52.23, lng: 21.01 }];
    const selected = { id: 9, lat: 50.0, lng: 19.0 };
    const merged = mergeSelectedOfferIntoMapPins(offers, selected);
    assert.equal(merged.length, 2);
  });

  it('detects coordinate inside region', () => {
    assert.equal(isCoordinateInMapRegion(52.23, 21.01, region), true);
    assert.equal(isCoordinateInMapRegion(40, 10, region), false);
  });

  it('caps pins near map center', () => {
    const offers = [
      { id: 1, lat: 52.23, lng: 21.01 },
      { id: 2, lat: 52.24, lng: 21.02 },
      { id: 3, lat: 50.0, lng: 19.0 },
    ];
    const capped = capMapPinsNearCenter(offers, region, 2);
    assert.equal(capped.length, 2);
    assert.ok(capped.some((o) => o.id === 1));
    assert.ok(capped.some((o) => o.id === 2));
  });

  it('hides privacy circles when map is zoomed out', () => {
    assert.equal(shouldShowMapPrivacyCircles(region), false);
    assert.equal(
      shouldShowMapPrivacyCircles({
        ...region,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      }),
      true,
    );
  });
});
