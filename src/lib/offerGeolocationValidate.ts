import {
  canonicalizeCity,
  canonicalizeDistrict,
  getDistrictsForCity,
  inferCityFromMapboxFeature,
  isStrictCity,
  normalizeText,
} from "@/lib/location/locationCatalog";
import { mapboxReverseGeocodeUrl } from "@/lib/mapboxReverseGeocode";

const REST_OF_COUNTRY_LABEL = "Reszta kraju";

type MapboxFeature = {
  text?: string;
  context?: Array<{ id?: string; text?: string; text_pl?: string }>;
  place_name?: string;
  place_name_pl?: string;
  place_type?: string[];
};

async function fetchReverseGeocodeFeature(lat: number, lng: number): Promise<MapboxFeature | null> {
  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  const endpoint = mapboxReverseGeocodeUrl(lng, lat, token, { language: "pl" });

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
    const text = String(item?.text_pl || item?.text || "").trim();
    if (text) return text;
  }
  return "";
}

/** Miasto z Mapbox reverse geocoding dla współrzędnych (serwer). */
export async function resolveCityAtCoordinates(lat: number, lng: number): Promise<string> {
  const feature = await fetchReverseGeocodeFeature(lat, lng);
  return inferCityFromMapboxFeature(feature);
}

function isKnownDistrictOfCity(label: string, city: string): boolean {
  const normalized = normalizeText(label);
  if (!normalized || !isStrictCity(city)) return false;
  return getDistrictsForCity(city).some((entry) => normalizeText(entry) === normalized);
}

function pinMatchesSelectedCity(params: {
  selectedCity: string;
  district?: string | null;
  resolvedCity: string;
  pinLabel: string;
}): boolean {
  const { selectedCity, district, resolvedCity, pinLabel } = params;
  const candidates = [resolvedCity, pinLabel].map((v) => String(v || "").trim()).filter(Boolean);

  for (const candidate of candidates) {
    if (normalizeText(candidate) === normalizeText(selectedCity)) return true;

    const districtCanon = canonicalizeDistrict(selectedCity, district || "");
    if (districtCanon && normalizeText(candidate) === normalizeText(districtCanon)) return true;

    if (isKnownDistrictOfCity(candidate, selectedCity)) return true;

    const asDistrict = canonicalizeDistrict(selectedCity, candidate);
    if (asDistrict && isKnownDistrictOfCity(asDistrict, selectedCity)) return true;
  }

  return false;
}

function collectPinLocationCandidates(feature: MapboxFeature | null): {
  resolvedCity: string;
  pinLabel: string;
} {
  if (!feature) return { resolvedCity: "", pinLabel: "" };

  const pinLabel = String(feature.text || "").trim();
  const context = feature.context;
  const placeCity = canonicalizeCity(mapboxContextByPrefix(context, "place"));
  const localityCity = canonicalizeCity(mapboxContextByPrefix(context, "locality"));
  const inferredCity = inferCityFromMapboxFeature(feature);

  const resolvedCity = placeCity || inferredCity || localityCity || "";

  return { resolvedCity, pinLabel };
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
  const { resolvedCity, pinLabel } = collectPinLocationCandidates(feature);

  if (!resolvedCity && !pinLabel) return;

  const isRestOfCountry = normalizeText(selected) === normalizeText(REST_OF_COUNTRY_LABEL);
  const compareTarget = isRestOfCountry
    ? canonicalizeCity(params.district || "") || selected
    : selected;

  if (!compareTarget) return;

  if (
    pinMatchesSelectedCity({
      selectedCity: compareTarget,
      district: params.district,
      resolvedCity,
      pinLabel,
    })
  ) {
    return;
  }

  const displayResolved = resolvedCity || pinLabel;
  throw new Error(
    `Pinezka na mapie wskazuje ${displayResolved}, a wybrane miasto to ${isRestOfCountry ? compareTarget : selected}. Przesuń pinezkę lub zmień miasto.`,
  );
}
