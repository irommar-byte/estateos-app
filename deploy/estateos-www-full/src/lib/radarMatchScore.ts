import { canonicalizeCity, normalizeText } from '@/lib/location/locationCatalog';
import { getCanonicalOfferPricePln } from '@/lib/money/offerPrice';

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseDistricts(pref: { districts?: unknown }): string[] {
  try {
    const raw =
      typeof pref.districts === 'string' ? JSON.parse(pref.districts) : pref.districts;
    if (!Array.isArray(raw)) return [];
    return raw.map((d) => normalizeText(String(d))).filter(Boolean);
  } catch {
    return [];
  }
}

function offerCoords(offer: Record<string, unknown>): { lat: number; lng: number } | null {
  const lat = Number(offer.lat ?? offer.latitude);
  const lng = Number(offer.lng ?? offer.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function isMapMode(pref: { lat?: unknown; lng?: unknown; radius?: unknown }): boolean {
  const lat = Number(pref.lat);
  const lng = Number(pref.lng);
  const radius = Number(pref.radius);
  return Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(radius) && radius > 0;
}

function radarGeoRadiusLimitKm(baseRadiusKm: number, matchThreshold: number): number {
  const t = Math.max(50, Math.min(100, matchThreshold));
  const normalizedRelax = Math.max(0, Math.min(1, (100 - t) / 50));
  return baseRadiusKm * (1 + normalizedRelax);
}

function upperLimitScore(value: number, max: number, fullDropPct: number): number {
  if (!max || value <= max) return 100;
  const ceiling = max * (1 + fullDropPct);
  if (value >= ceiling) return clampScore((max / Math.max(1, value)) * 60);
  return clampScore(60 + ((ceiling - value) / Math.max(1, ceiling - max)) * 40);
}

function lowerLimitScore(value: number, min: number, fullDropPct: number): number {
  if (!min || value >= min) return 100;
  const floor = Math.max(0, min * (1 - fullDropPct));
  if (value <= floor) return clampScore((value / Math.max(1, min)) * 60);
  return clampScore(60 + ((value - floor) / Math.max(1, min - floor)) * 40);
}

function yearScore(year: number, minYear: number): number {
  if (!minYear || minYear <= 1900 || year >= minYear) return 100;
  const yearsOlder = minYear - year;
  if (yearsOlder <= 15) return clampScore(100 - (yearsOlder / 15) * 40);
  return clampScore(60 - Math.min(60, ((yearsOlder - 15) / 35) * 60));
}

function amenityScore(offer: Record<string, unknown>, pref: Record<string, unknown>): number {
  const required = [
    pref.requireBalcony ? !!offer.hasBalcony : null,
    pref.requireGarden ? !!offer.hasGarden : null,
    pref.requireElevator ? !!offer.hasElevator : null,
    pref.requireParking ? !!offer.hasParking : null,
    pref.requireFurnished ? !!offer.isFurnished : null,
    pref.requireTwoLevel ? !!offer.isTwoLevel : null,
  ].filter((v) => v !== null) as boolean[];
  if (required.length === 0) return 100;
  const present = required.filter(Boolean).length;
  return clampScore((present / required.length) * 100);
}

function citiesMatch(prefCity: unknown, offerCity: unknown): boolean {
  const a = normalizeText(canonicalizeCity(String(prefCity || '')) || String(prefCity || '').trim());
  const b = normalizeText(canonicalizeCity(String(offerCity || '')) || String(offerCity || '').trim());
  if (!a || !b) return true;
  return a === b;
}

function locationScore(
  pref: Record<string, unknown>,
  offer: Record<string, unknown>,
): number {
  const mapMode = isMapMode(pref);
  const coords = offerCoords(offer);

  if (mapMode) {
    if (!coords) return 0;
    const baseRadius = Math.max(0.1, Number(pref.radius));
    const dKm = distanceKm(Number(pref.lat), Number(pref.lng), coords.lat, coords.lng);
    if (dKm <= baseRadius) return 100;
    if (dKm <= baseRadius * 2) return clampScore(100 - ((dKm / baseRadius) - 1) * 50);
    return 0;
  }

  if (pref.city && offer.city) {
    if (!citiesMatch(pref.city, offer.city)) return 0;
  }

  const districts = parseDistricts(pref);
  if (districts.length === 0) return 100;

  const offerDistrict = offer.district ? normalizeText(String(offer.district)) : null;
  if (!offerDistrict) return 50;
  return districts.includes(offerDistrict) ? 100 : 50;
}

function passesLocationGate(pref: Record<string, unknown>, offer: Record<string, unknown>): boolean {
  const mapMode = isMapMode(pref);
  const coords = offerCoords(offer);
  const threshold = Number(pref.minMatchThreshold ?? 70);

  if (mapMode) {
    if (!coords) return false;
    const limitKm = radarGeoRadiusLimitKm(Number(pref.radius), threshold);
    const dKm = distanceKm(Number(pref.lat), Number(pref.lng), coords.lat, coords.lng);
    return dKm <= limitKm;
  }

  if (pref.city && offer.city) {
    if (!citiesMatch(pref.city, offer.city)) return false;
  }

  const districts = parseDistricts(pref);
  if (districts.length === 0) return true;

  const offerDistrict = offer.district ? normalizeText(String(offer.district)) : null;
  if (!offerDistrict) return false;
  return districts.some((d) => d === offerDistrict);
}

/** Parity z aplikacją mobilną (`RadarHomeScreen.radarMatchScore`). Zwraca 0–100. */
export function calculateRadarMatchScore(pref: Record<string, unknown>, offer: Record<string, unknown>): number {
  if (!passesLocationGate(pref, offer)) return 0;

  const txPref = String(pref.transactionType || '').toUpperCase();
  const txOffer = String(offer.transactionType || '').toUpperCase();
  if (txPref && txOffer && txPref !== txOffer) return 0;

  const propPref = String(pref.propertyType || '').toUpperCase();
  if (propPref && propPref !== 'ALL') {
    const propOffer = String(offer.propertyType || '').toUpperCase();
    if (propOffer && propPref !== propOffer) return 0;
  }

  const rawPrice = getCanonicalOfferPricePln(offer);
  const rawArea = Number(offer.area ?? 0);
  const yearRaw = offer.yearBuilt != null ? parseInt(String(offer.yearBuilt), 10) : 1900;
  const year = Number.isFinite(yearRaw) ? yearRaw : 1900;

  const parts = [
    { weight: 30, score: locationScore(pref, offer) },
    { weight: 25, score: upperLimitScore(rawPrice, Number(pref.maxPrice || 0), 0.1) },
    { weight: 15, score: lowerLimitScore(rawArea, Number(pref.minArea || 0), 0.2) },
    { weight: 10, score: yearScore(year, Number(pref.minYear || 0)) },
    { weight: 20, score: amenityScore(offer, pref) },
  ];

  const total = parts.reduce((sum, part) => sum + part.weight * part.score, 0);
  const weight = parts.reduce((sum, part) => sum + part.weight, 0);
  return clampScore(total / Math.max(1, weight));
}

export function radarMatchThreshold(pref: Record<string, unknown>): number {
  return Math.max(50, Math.min(100, Number(pref.minMatchThreshold ?? 70)));
}
