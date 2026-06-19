import { coordKeyForCityDistrict } from "@/lib/location/districtCoordKeys";
import {
  getDistrictsForCity,
  inferStrictDistrictFromMapboxFeature,
  isStrictCity,
  normalizeText,
  validateCityDistrict,
} from "@/lib/location/locationCatalog";

const DISTRICT_COORDS: Record<string, { lat: number; lng: number }> = {
  Warszawa: { lat: 52.2297, lng: 21.0122 },
  Bemowo: { lat: 52.254, lng: 20.91 },
  Białołęka: { lat: 52.33, lng: 21.04 },
  Bielany: { lat: 52.29, lng: 20.94 },
  Mokotów: { lat: 52.193, lng: 21.029 },
  Ochota: { lat: 52.211, lng: 20.985 },
  "Praga-Południe": { lat: 52.247, lng: 21.09 },
  "Praga-Północ": { lat: 52.26, lng: 21.04 },
  Rembertów: { lat: 52.265, lng: 21.19 },
  Śródmieście: { lat: 52.231, lng: 21.012 },
  Targówek: { lat: 52.295, lng: 21.045 },
  Ursus: { lat: 52.196, lng: 20.886 },
  Ursynów: { lat: 52.14, lng: 21.045 },
  Wawer: { lat: 52.215, lng: 21.183 },
  Wesoła: { lat: 52.247, lng: 21.23 },
  Wilanów: { lat: 52.166, lng: 21.09 },
  Włochy: { lat: 52.196, lng: 20.945 },
  Wola: { lat: 52.236, lng: 20.958 },
  Żoliborz: { lat: 52.273, lng: 20.984 },
  "Łódź": { lat: 51.7592, lng: 19.456 },
  Bałuty: { lat: 51.8003, lng: 19.4244 },
  Górna: { lat: 51.7225, lng: 19.4756 },
  Polesie: { lat: 51.7578, lng: 19.4186 },
  Widzew: { lat: 51.76, lng: 19.53 },
  Kraków: { lat: 50.0614, lng: 19.9366 },
  "Stare Miasto": { lat: 50.0614, lng: 19.9366 },
  Grzegórzki: { lat: 50.0583, lng: 19.9583 },
  "Prądnik Czerwony": { lat: 50.0883, lng: 19.9692 },
  "Prądnik Biały": { lat: 50.0933, lng: 19.93 },
  Krowodrza: { lat: 50.0733, lng: 19.9183 },
  Bronowice: { lat: 50.0817, lng: 19.8833 },
  Zwierzyniec: { lat: 50.0533, lng: 19.8833 },
  Dębniki: { lat: 50.035, lng: 19.91 },
  "Łagiewniki-Borek Fałęcki": { lat: 50.0183, lng: 19.9317 },
  Swoszowice: { lat: 49.9883, lng: 19.9383 },
  "Podgórze Duchackie": { lat: 50.0167, lng: 19.9617 },
  "Bieżanów-Prokocim": { lat: 50.0167, lng: 20.005 },
  Podgórze: { lat: 50.035, lng: 19.9617 },
  Czyżyny: { lat: 50.0733, lng: 20.005 },
  Mistrzejowice: { lat: 50.0967, lng: 20.0133 },
  Bieńczyce: { lat: 50.0867, lng: 20.0267 },
  "Wzgórza Krzesławickie": { lat: 50.0983, lng: 20.065 },
  "Nowa Huta": { lat: 50.0717, lng: 20.0383 },
  Wrocław: { lat: 51.1079, lng: 17.0385 },
  Fabryczna: { lat: 51.111, lng: 16.963 },
  Krzyki: { lat: 51.076, lng: 17.012 },
  "Psie Pole": { lat: 51.144, lng: 17.108 },
  "Stare Miasto WRO": { lat: 51.1079, lng: 17.0385 },
  "Śródmieście WRO": { lat: 51.119, lng: 17.054 },
  Poznań: { lat: 52.4064, lng: 16.9252 },
  Grunwald: { lat: 52.392, lng: 16.873 },
  Jeżyce: { lat: 52.413, lng: 16.89 },
  Wilda: { lat: 52.388, lng: 16.922 },
  "Stare Miasto POZ": { lat: 52.406, lng: 16.925 },
  "Nowe Miasto POZ": { lat: 52.395, lng: 16.965 },
  "Gdańsk - Śródmieście": { lat: 54.352, lng: 18.646 },
  "Gdańsk - Wrzeszcz": { lat: 54.38, lng: 18.605 },
  "Gdańsk - Oliwa": { lat: 54.409, lng: 18.563 },
  "Gdańsk - Przymorze": { lat: 54.41, lng: 18.595 },
  "Gdańsk - Zaspa": { lat: 54.395, lng: 18.605 },
  "Gdańsk - Osowa": { lat: 54.425, lng: 18.46 },
  "Gdańsk - Chełm": { lat: 54.335, lng: 18.62 },
  "Gdańsk - Jasień": { lat: 54.335, lng: 18.565 },
  "Gdynia - Śródmieście": { lat: 54.518, lng: 18.53 },
  "Gdynia - Orłowo": { lat: 54.48, lng: 18.56 },
  "Gdynia - Redłowo": { lat: 54.495, lng: 18.54 },
  "Gdynia - Chylonia": { lat: 54.535, lng: 18.47 },
  "Sopot - Dolny": { lat: 54.445, lng: 18.565 },
  "Sopot - Górny": { lat: 54.44, lng: 18.55 },
  Lublin: { lat: 51.2465, lng: 22.5684 },
  "Śródmieście LUB": { lat: 51.2465, lng: 22.5684 },
  Czechów: { lat: 51.271, lng: 22.553 },
  LSM: { lat: 51.236, lng: 22.535 },
  Zamość: { lat: 50.7231, lng: 23.2519 },
  "Stare Miasto ZAM": { lat: 50.7231, lng: 23.2519 },
  "Nowe Miasto ZAM": { lat: 50.72, lng: 23.27 },
  "Planty ZAM": { lat: 50.715, lng: 23.25 },
  Gdańsk: { lat: 54.352, lng: 18.6466 },
  Gdynia: { lat: 54.5189, lng: 18.5305 },
  Sopot: { lat: 54.4416, lng: 18.5601 },
  Katowice: { lat: 50.2649, lng: 19.0238 },
  Rybnik: { lat: 50.0971, lng: 18.5418 },
  Białystok: { lat: 53.1325, lng: 23.1688 },
};

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
  const cityDistricts = getDistrictsForCity(city);
  if (!cityDistricts.length) return "";

  let closest = cityDistricts[0];
  let minKm = Infinity;
  for (const district of cityDistricts) {
    const key = coordKeyForCityDistrict(city, district);
    const coords = DISTRICT_COORDS[key] ?? DISTRICT_COORDS[city];
    if (!coords) continue;
    const km = haversineKm(lat, lng, coords.lat, coords.lng);
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
