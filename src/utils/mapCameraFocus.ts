import { Dimensions } from 'react-native';
import type MapView from 'react-native-maps';

/** Padding kamery, żeby pinezka nie chowała się pod paskiem powodu + karuzelą. */
export const MAP_OVERLAY_EDGE_PADDING = {
  top: 140,
  right: 56,
  bottom: 360,
  left: 56,
} as const;

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

const FOCUS_LAT_DELTA = 0.022;
const FOCUS_LNG_DELTA = 0.022;

/**
 * Przesuwa środek regionu na południe, żeby współrzędna trafiła w widoczną
 * część mapy (nad dolnym overlayem z kartami), a nie pod karuzelę.
 */
function regionWithPinAboveOverlay(coordinate: MapCoordinate) {
  const { height } = Dimensions.get('window');
  const bottomPad = MAP_OVERLAY_EDGE_PADDING.bottom;
  const topPad = MAP_OVERLAY_EDGE_PADDING.top;
  const visibleSpan = Math.max(height - bottomPad - topPad, height * 0.35);
  // Środek widocznego prostokąta vs geometryczny środek ekranu (0.5).
  const visibleCenterY = topPad + visibleSpan / 2;
  const bias = (0.5 * height - visibleCenterY) / height;
  const latDelta = FOCUS_LAT_DELTA;
  const lngDelta = FOCUS_LNG_DELTA;
  return {
    latitude: coordinate.latitude - latDelta * Math.max(0.12, Math.min(0.42, bias)),
    longitude: coordinate.longitude,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

/**
 * Ustawia kamerę tak, by współrzędna była w widocznej części mapy
 * (nad dolnym overlayem z kartami ofert).
 */
export function focusMapCoordinateAboveOverlay(
  map: MapView | null | undefined,
  coordinate: MapCoordinate,
  opts?: { animated?: boolean; edgePadding?: Partial<typeof MAP_OVERLAY_EDGE_PADDING> },
): void {
  if (!map) return;
  const lat = Number(coordinate.latitude);
  const lng = Number(coordinate.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const region = regionWithPinAboveOverlay({ latitude: lat, longitude: lng });
  if (opts?.animated === false) {
    map.animateToRegion(region, 0);
    return;
  }
  map.animateToRegion(region, 380);
}

export function fitMapCoordinatesAboveOverlay(
  map: MapView | null | undefined,
  coordinates: MapCoordinate[],
  opts?: { animated?: boolean; edgePadding?: Partial<typeof MAP_OVERLAY_EDGE_PADDING> },
): void {
  if (!map || coordinates.length === 0) return;
  const valid = coordinates.filter(
    (c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude),
  );
  if (!valid.length) return;

  if (valid.length === 1) {
    focusMapCoordinateAboveOverlay(map, valid[0], opts);
    return;
  }

  const edgePadding = {
    ...MAP_OVERLAY_EDGE_PADDING,
    ...(opts?.edgePadding || {}),
  };

  map.fitToCoordinates(valid, {
    edgePadding,
    animated: opts?.animated !== false,
  });
}
