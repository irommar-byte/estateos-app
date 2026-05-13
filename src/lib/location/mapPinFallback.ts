import { canonicalizeCity, normalizeText } from '@/lib/location/locationCatalog';

/** Środek miasta (przybliżenie) — gdy brak GPS w ofercie. */
const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  warszawa: { lat: 52.2297, lng: 21.0122 },
  krakow: { lat: 50.0647, lng: 19.945 },
  wroclaw: { lat: 51.1079, lng: 17.0385 },
  poznan: { lat: 52.4064, lng: 16.9252 },
  lodz: { lat: 51.7592, lng: 19.4559 },
  lublin: { lat: 51.2465, lng: 22.5684 },
  gdansk: { lat: 54.352, lng: 18.6466 },
  gdynia: { lat: 54.5189, lng: 18.5305 },
  sopot: { lat: 54.4418, lng: 18.5601 },
  katowice: { lat: 50.2649, lng: 19.0238 },
  rybnik: { lat: 50.0971, lng: 18.5418 },
  bialystok: { lat: 53.1325, lng: 23.1688 },
  zamosc: { lat: 50.7231, lng: 23.251 },
};

/**
 * Przybliżone centra dzielnic Warszawy (gdy oferta ma dzielnicę, ale brak lat/lng).
 * Klucze: normalizeText("Mokotów") itd.
 */
const WARSAW_DISTRICT: Record<string, { lat: number; lng: number }> = {
  bemowo: { lat: 52.2547, lng: 20.9278 },
  bialoleka: { lat: 52.3071, lng: 21.0855 },
  bielany: { lat: 52.2923, lng: 20.9359 },
  mokotow: { lat: 52.1751, lng: 21.0314 },
  wilanow: { lat: 52.1631, lng: 21.0909 },
  zoliborz: { lat: 52.2719, lng: 20.9859 },
  ochota: { lat: 52.2215, lng: 20.9856 },
  'praga-poludnie': { lat: 52.2392, lng: 21.0728 },
  'praga-polnoc': { lat: 52.2541, lng: 21.0355 },
  'praga poludnie': { lat: 52.2392, lng: 21.0728 },
  'praga polnoc': { lat: 52.2541, lng: 21.0355 },
  pragapoludnie: { lat: 52.2392, lng: 21.0728 },
  pragapolnoc: { lat: 52.2541, lng: 21.0355 },
  rembertow: { lat: 52.2586, lng: 21.1636 },
  srodmiescie: { lat: 52.2297, lng: 21.0122 },
  targowek: { lat: 52.2739, lng: 21.0739 },
  ursus: { lat: 52.1954, lng: 20.8922 },
  ursynow: { lat: 52.1508, lng: 21.0501 },
  wawer: { lat: 52.1956, lng: 21.1514 },
  wesola: { lat: 52.2548, lng: 21.2241 },
  wlochy: { lat: 52.1964, lng: 20.9011 },
  wola: { lat: 52.2389, lng: 20.9583 },
  other: { lat: 52.22, lng: 21.05 },
};

function cityCenter(city: string | null | undefined): { lat: number; lng: number } {
  const c = normalizeText(canonicalizeCity(city || '') || city || '');
  return CITY_CENTERS[c] || CITY_CENTERS.warszawa;
}

function warsawDistrictCoords(district: string | null | undefined): { lat: number; lng: number } | null {
  const d = normalizeText(String(district || '').replaceAll('_', ' '));
  if (!d) return null;
  if (WARSAW_DISTRICT[d]) return WARSAW_DISTRICT[d];
  const compact = d.replace(/[^a-z0-9]/g, '');
  if (WARSAW_DISTRICT[compact]) return WARSAW_DISTRICT[compact];
  if (d === 'other' || d === 'inny obszar') return WARSAW_DISTRICT.other;
  return null;
}

/** Deterministyczny rozrzut pinów w obrębie ~kilometrów (żeby nie nakładały się w jednym punkcie). */
export function jitterLatLng(id: number, lat: number, lng: number): { lat: number; lng: number } {
  const a = ((id * 9301 + 49297) % 233280) / 233280;
  const b = ((id * 7919 + 104729) % 233280) / 233280;
  const dLat = (a - 0.5) * 0.035;
  const dLng = (b - 0.5) * 0.05;
  return { lat: lat + dLat, lng: lng + dLng };
}

/**
 * Zwraca współrzędne do mapy publicznej: najpierw prawdziwe lat/lng, inaczej przybliżenie z miasta/dzielnicy.
 */
export function resolvePublicMapPin(input: {
  id: number;
  city: string | null | undefined;
  district: string | null | undefined;
  lat: number | null | undefined;
  lng: number | null | undefined;
}): { lat: number; lng: number; approximate: boolean } {
  const lat = input.lat != null ? Number(input.lat) : NaN;
  const lng = input.lng != null ? Number(input.lng) : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng, approximate: false };
  }

  const canonCity = canonicalizeCity(input.city || '') || String(input.city || '').trim();
  const center = cityCenter(canonCity || input.city);

  if (normalizeText(canonCity) === 'warszawa') {
    const d = warsawDistrictCoords(input.district);
    const base = d || WARSAW_DISTRICT.other;
    return { ...jitterLatLng(input.id, base.lat, base.lng), approximate: true };
  }

  return { ...jitterLatLng(input.id, center.lat, center.lng), approximate: true };
}
