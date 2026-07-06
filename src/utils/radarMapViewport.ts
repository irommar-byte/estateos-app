import type { Region } from 'react-native-maps';

type MappableOffer = {
  id?: number | string | null;
  lat: unknown;
  lng: unknown;
};

/** Padding for supercluster bbox — wider than viewport so edge clusters do not vanish on pan. */
export const CLUSTER_QUERY_BBOX_PADDING = 1.34;

/** Expand visible bounds so pins near edges do not pop in/out while panning. */
export function expandMapRegion(region: Region, paddingFactor = 1.28): Region {
  return {
    ...region,
    latitudeDelta: region.latitudeDelta * paddingFactor,
    longitudeDelta: region.longitudeDelta * paddingFactor,
  };
}

/** Bbox for react-native-map-clustering / supercluster ([west, south, east, north]). */
export function calculateClusterQueryBBox(
  region: Region,
  paddingFactor = CLUSTER_QUERY_BBOX_PADDING,
): [number, number, number, number] {
  const expanded = expandMapRegion(region, paddingFactor);
  let lngD = expanded.longitudeDelta;
  if (lngD < 0) lngD += 360;

  return [
    expanded.longitude - lngD,
    expanded.latitude - expanded.latitudeDelta,
    expanded.longitude + lngD,
    expanded.latitude + expanded.latitudeDelta,
  ];
}

export function isCoordinateInMapRegion(
  lat: number,
  lng: number,
  region: Region,
): boolean {
  const halfLat = region.latitudeDelta / 2;
  const halfLng = region.longitudeDelta / 2;
  return (
    lat >= region.latitude - halfLat &&
    lat <= region.latitude + halfLat &&
    lng >= region.longitude - halfLng &&
    lng <= region.longitude + halfLng
  );
}

export function filterOffersInMapRegion<T extends MappableOffer>(
  offers: T[],
  region: Region | null | undefined,
  paddingFactor = 1.28,
): T[] {
  if (!region) return offers;
  const expanded = expandMapRegion(region, paddingFactor);
  return offers.filter((offer) => {
    const lat = Number(offer.lat);
    const lng = Number(offer.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    return isCoordinateInMapRegion(lat, lng, expanded);
  });
}

export function mergeSelectedOfferIntoMapPins<T extends MappableOffer>(
  offers: T[],
  selected: T | null | undefined,
): T[] {
  if (!selected?.id) return offers;
  if (offers.some((o) => String(o.id) === String(selected.id))) return offers;
  return [...offers, selected];
}

/** Approximate-location rings are only useful when zoomed in; hide at city/region scale. */
export function shouldShowMapPrivacyCircles(region: Region | null | undefined): boolean {
  if (!region) return false;
  return region.latitudeDelta < 0.065;
}

/** iOS AIRMap crashes when too many subviews mount at once — keep a safe cap. */
export function capMapPinsNearCenter<T extends MappableOffer>(
  offers: T[],
  region: Region,
  maxPins: number,
): T[] {
  if (maxPins <= 0 || offers.length <= maxPins) return offers;
  const centerLat = region.latitude;
  const centerLng = region.longitude;
  return [...offers]
    .sort((a, b) => {
      const aLat = Number(a.lat);
      const aLng = Number(a.lng);
      const bLat = Number(b.lat);
      const bLng = Number(b.lng);
      const aDist =
        (aLat - centerLat) * (aLat - centerLat) + (aLng - centerLng) * (aLng - centerLng);
      const bDist =
        (bLat - centerLat) * (bLat - centerLat) + (bLng - centerLng) * (bLng - centerLng);
      return aDist - bDist;
    })
    .slice(0, maxPins);
}
