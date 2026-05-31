import {
  canonicalizeCity,
  canonicalizeDistrict,
  getDistrictsForCity,
  inferCityFromMapboxFeature,
  isStrictCity,
  normalizeText,
} from "@/lib/location/locationCatalog";
import { citiesEquivalent } from "@/lib/location/cityNameEquivalence";
import {
  buildForwardGeocodeSearchText,
  mapboxForwardGeocodeUrl,
} from "@/lib/mapboxGeocodeClient";
import { mapboxReverseGeocodeUrl } from "@/lib/mapboxReverseGeocode";

const REST_OF_COUNTRY_LABEL = "Reszta kraju";
/** Maks. odległość pinezki od centrum miasta (forward geocode) — fallback globalny. */
const MAX_CITY_CENTER_DISTANCE_KM = 50;

type MapboxFeature = {
  text?: string;
  center?: [number, number];
  geometry?: { coordinates?: [number, number] };
  context?: Array<{ id?: string; text?: string; text_pl?: string; text_en?: string }>;
  place_name?: string;
  place_name_pl?: string;
  place_type?: string[];
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function featureCenter(feature: MapboxFeature | null | undefined): [number, number] | null {
  if (!feature) return null;
  if (Array.isArray(feature.center) && feature.center.length >= 2) {
    return [Number(feature.center[1]), Number(feature.center[0])];
  }
  const coords = feature.geometry?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    return [Number(coords[1]), Number(coords[0])];
  }
  return null;
}

async function fetchReverseGeocodeFeature(lat: number, lng: number): Promise<MapboxFeature | null> {
  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  const endpoint = mapboxReverseGeocodeUrl(lng, lat, token, { language: "en" });

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json();
    return Array.isArray(payload?.features) ? payload.features[0] : null;
  } catch {
    return null;
  }
}

function mapboxContextByPrefix(
  context: MapboxFeature["context"],
  prefix: string,
): string {
  if (!Array.isArray(context)) return "";
  for (const item of context) {
    if (!String(item?.id || "").startsWith(prefix)) continue;
    const text = String(item?.text_en || item?.text || item?.text_pl || "").trim();
    if (text) return text;
  }
  return "";
}

function collectCityLabelVariants(feature: MapboxFeature | null): string[] {
  if (!feature) return [];

  const variants = new Set<string>();
  const add = (value: unknown) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return;
    if (/^(powiat|gmina|województwo|wojewodztwo)\s/i.test(trimmed)) return;
    if (/^(polska|poland|deutschland|germany|france|francja|spain|hiszpania)$/i.test(trimmed)) return;
    variants.add(trimmed);
  };

  add(feature.text);

  if (Array.isArray(feature.context)) {
    for (const item of feature.context) {
      const id = String(item?.id || "");
      if (
        id.startsWith("place") ||
        id.startsWith("locality") ||
        id.startsWith("district") ||
        id.startsWith("neighborhood")
      ) {
        add(item.text_en);
        add(item.text);
        add(item.text_pl);
      }
    }
  }

  for (const placeName of [feature.place_name, feature.place_name_pl]) {
    if (!placeName) continue;
    for (const segment of String(placeName).split(",")) {
      add(segment.replace(/^\d{2}-\d{3}\s+/i, "").trim());
    }
  }

  return [...variants];
}

/** Miasto z Mapbox reverse geocoding dla współrzędnych (serwer). */
export async function resolveCityAtCoordinates(lat: number, lng: number): Promise<string> {
  const feature = await fetchReverseGeocodeFeature(lat, lng);
  return inferCityFromMapboxFeature(feature);
}

function isKnownDistrictOfCity(label: string, city: string): boolean {
  if (!isStrictCity(city)) return false;
  const normalized = normalizeText(label);
  if (!normalized) return false;
  return getDistrictsForCity(city).some((entry) => normalizeText(entry) === normalized);
}

function labelMatchesCity(label: string, city: string, district?: string | null): boolean {
  const trimmed = String(label || "").trim();
  if (!trimmed || !city) return false;

  if (citiesEquivalent(trimmed, city)) return true;

  const districtCanon = canonicalizeDistrict(city, district || "");
  if (districtCanon && citiesEquivalent(trimmed, districtCanon)) return true;

  if (isKnownDistrictOfCity(trimmed, city)) return true;

  const asDistrict = canonicalizeDistrict(city, trimmed);
  if (asDistrict && isKnownDistrictOfCity(asDistrict, city)) return true;

  return false;
}

function pinMatchesSelectedCity(params: {
  selectedCity: string;
  district?: string | null;
  labelVariants: string[];
}): boolean {
  for (const label of params.labelVariants) {
    if (labelMatchesCity(label, params.selectedCity, params.district)) return true;
  }
  return false;
}

function collectPinLocationCandidates(feature: MapboxFeature | null): {
  resolvedCity: string;
  labelVariants: string[];
} {
  if (!feature) return { resolvedCity: "", labelVariants: [] };

  const labelVariants = collectCityLabelVariants(feature);
  const context = feature.context;
  const placeCity = canonicalizeCity(mapboxContextByPrefix(context, "place"));
  const localityCity = canonicalizeCity(mapboxContextByPrefix(context, "locality"));
  const inferredCity = inferCityFromMapboxFeature(feature);

  const resolvedCity = placeCity || inferredCity || localityCity || labelVariants[0] || "";

  return { resolvedCity, labelVariants };
}

async function pinWithinSelectedCityRegion(
  lat: number,
  lng: number,
  city: string,
): Promise<boolean> {
  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return false;

  const searchText = buildForwardGeocodeSearchText(city, "");
  const query = searchText || city;

  try {
    const url = mapboxForwardGeocodeUrl(query, token, {
      limit: 5,
      autocomplete: false,
      cityHint: city,
    });
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return false;
    const payload = await response.json();
    const features: MapboxFeature[] = Array.isArray(payload?.features) ? payload.features : [];

    for (const feature of features) {
      const center = featureCenter(feature);
      if (!center) continue;

      const distanceKm = haversineKm(lat, lng, center[0], center[1]);
      if (distanceKm > MAX_CITY_CENTER_DISTANCE_KM) continue;

      const featureCity = inferCityFromMapboxFeature(feature);
      const featureLabels = collectCityLabelVariants(feature);
      if ([featureCity, ...featureLabels].some((label) => citiesEquivalent(label, city))) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

export async function assertCoordinatesMatchCity(params: {
  lat: number;
  lng: number;
  city: string;
  district?: string | null;
}): Promise<void> {
  const selected = canonicalizeCity(params.city);
  if (!selected) return;

  const feature = await fetchReverseGeocodeFeature(params.lat, params.lng);
  const { resolvedCity, labelVariants } = collectPinLocationCandidates(feature);

  if (!resolvedCity && labelVariants.length === 0) return;

  const isRestOfCountry = normalizeText(selected) === normalizeText(REST_OF_COUNTRY_LABEL);
  const compareTarget = isRestOfCountry
    ? canonicalizeCity(params.district || "") || selected
    : selected;

  if (!compareTarget) return;

  if (
    pinMatchesSelectedCity({
      selectedCity: compareTarget,
      district: params.district,
      labelVariants,
    })
  ) {
    return;
  }

  if (await pinWithinSelectedCityRegion(params.lat, params.lng, compareTarget)) {
    return;
  }

  const displayResolved = resolvedCity || labelVariants[0] || "";
  throw new Error(
    `Pinezka na mapie wskazuje ${displayResolved}, a wybrane miasto to ${isRestOfCountry ? compareTarget : selected}. Przesuń pinezkę lub zmień miasto.`,
  );
}
