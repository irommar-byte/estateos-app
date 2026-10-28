import { DISTRICT_CENTROIDS } from "@/lib/location/districtCentroids";
import {
  getDistrictsForCity,
  inferStrictDistrictFromMapboxFeature,
  isStrictCity,
  normalizeText,
  validateCityDistrict,
} from "@/lib/location/locationCatalog";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

function matchDistrictByName(rawDistrict: string | null | undefined, city: string): string | null {
  if (!rawDistrict) return null;
  const cityDistricts = getDistrictsForCity(city);
  if (!cityDistricts.length) return null;
  const needle = normalizeText(rawDistrict);
  if (!needle) return null;

  if (city === "Warszawa" && /\bpraga\b/.test(needle)) {
    if (/\b(polnoc|pn)\b/.test(needle)) return "Praga-Północ";
    if (/\b(poludnie|pd|poludniowa)\b/.test(needle)) return "Praga-Południe";
    if (needle === "praga") return null;
  }

  for (const district of cityDistricts) {
    if (normalizeText(district) === needle) return district;
  }

  let prefixMatch: string | null = null;
  for (const district of cityDistricts) {
    const n = normalizeText(district);
    if (n.startsWith(needle) || needle.startsWith(n)) {
      if (prefixMatch && prefixMatch !== district) return null;
      prefixMatch = district;
    }
  }
  if (prefixMatch) return prefixMatch;

  let substringMatch: string | null = null;
  for (const district of cityDistricts) {
    const n = normalizeText(district);
    if (n.includes(needle) || needle.includes(n)) {
      if (substringMatch && substringMatch !== district) return null;
      substringMatch = district;
    }
  }
  return substringMatch;
}

function closestDistrictByCoords(city: string, lat: number, lng: number): string {
  const centroids = DISTRICT_CENTROIDS[city];
  if (!centroids) return "";
  let closest = "";
  let minKm = Infinity;
  for (const district of getDistrictsForCity(city)) {
    const point = centroids[district];
    if (!point) continue;
    const km = haversineKm(lat, lng, point[0], point[1]);
    if (km < minKm) {
      minKm = km;
      closest = district;
    }
  }
  return closest;
}

/** Dopasowuje dzielnicę strict-city do współrzędnych pinezki (jak aplikacja mobilna). */
export function resolveStrictDistrictFromPin(
  city: string,
  lat: number,
  lng: number,
  reverseDistrictLabel?: string | null,
  mapboxFeature?: Parameters<typeof inferStrictDistrictFromMapboxFeature>[1],
): string {
  const canonicalCity = city.trim();
  if (!isStrictCity(canonicalCity)) return "";

  const fromMapbox = inferStrictDistrictFromMapboxFeature(canonicalCity, mapboxFeature);
  if (fromMapbox) return fromMapbox;

  const fromReverse = matchDistrictByName(reverseDistrictLabel, canonicalCity);
  if (fromReverse) return fromReverse;

  return closestDistrictByCoords(canonicalCity, lat, lng);
}

export function resolveStrictDistrictForForm(
  city: string,
  lat: number,
  lng: number,
  candidates: string[],
): string {
  if (!isStrictCity(city)) return "";
  for (const candidate of candidates) {
    const v = validateCityDistrict(city, candidate);
    if (v.valid) return v.district;
  }
  return resolveStrictDistrictFromPin(city, lat, lng, candidates[0] ?? null);
}
