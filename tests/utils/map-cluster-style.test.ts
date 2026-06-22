import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatClusterCount,
  resolveClusterMarkerDimensions,
} from '../../src/utils/mapClusterStyle';
import { shouldShowMapPrivacyCircles } from '../../src/utils/radarMapViewport';

describe('mapClusterStyle', () => {
  it('formats cluster counts for display', () => {
    assert.equal(formatClusterCount(3), '3');
    assert.equal(formatClusterCount(42), '42');
    assert.equal(formatClusterCount(120), '99+');
    assert.equal(formatClusterCount(1500), '1.5k');
  });

  it('scales cluster marker dimensions with density', () => {
    const small = resolveClusterMarkerDimensions(2);
    const large = resolveClusterMarkerDimensions(80);
    assert.ok(large.outer > small.outer);
    assert.ok(large.inner > small.inner);
  });
});

describe('shouldShowMapPrivacyCircles', () => {
  it('hides privacy rings when zoomed out', () => {
    assert.equal(
      shouldShowMapPrivacyCircles({
        latitude: 52.23,
        longitude: 21.01,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      }),
      false,
    );
    assert.equal(
      shouldShowMapPrivacyCircles({
        latitude: 52.23,
        longitude: 21.01,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }),
      true,
    );
  });
});
