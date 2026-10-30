import {
  canonicalizeCity,
  canonicalizeDistrict,
  normalizeText,
  resolveCanonicalOfferDistrict,
} from '@/lib/location/locationCatalog';
import { getCanonicalOfferPricePln } from '@/lib/money/offerPrice';
import { offerHasAmenityFromBrain, type IntelligenceAmenityField } from '@/lib/intelligenceAmenityBrain';
import { offerInsideSearchPolygon } from '@/lib/geo/searchPolygon';

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

function parseDistricts(pref: { districts?: unknown; city?: unknown }): string[] {
  try {
    const raw =
      typeof pref.districts === 'string' ? JSON.parse(pref.districts) : pref.districts;
    if (!Array.isArray(raw)) return [];
    const city = String(pref.city || '');
    return raw
      .map((d) => canonicalizeDistrict(city, String(d)) || String(d))
      .map((d) => normalizeText(d))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function offerDistrictNormalized(pref: Record<string, unknown>, offer: Record<string, unknown>): string | null {
  const city = String(offer.city || pref.city || '');
  const resolved = resolveCanonicalOfferDistrict(city, offer);
  return resolved ? normalizeText(resolved) : null;
}

function amenityOn(offer: Record<string, unknown>, field: IntelligenceAmenityField): boolean {
  return offerHasAmenityFromBrain(
    {
      title: offer.title != null ? String(offer.title) : null,
      description: offer.description != null ? String(offer.description) : null,
      hasBalcony: offer.hasBalcony as boolean | null | undefined,
      hasGarden: offer.hasGarden as boolean | null | undefined,
      hasElevator: offer.hasElevator as boolean | null | undefined,
      hasParking: offer.hasParking as boolean | null | undefined,
      isFurnished: offer.isFurnished as boolean | null | undefined,
      hasStorage: offer.hasStorage as boolean | null | undefined,
    },
    field,
  );
}

function passesAmenityGate(offer: Record<string, unknown>, pref: Record<string, unknown>): boolean {
  if (pref.requireBalcony && !amenityOn(offer, 'hasBalcony')) return false;
  if (pref.requireGarden && !amenityOn(offer, 'hasGarden')) return false;
  if (pref.requireElevator && !amenityOn(offer, 'hasElevator')) return false;
  if (pref.requireParking && !amenityOn(offer, 'hasParking')) return false;
  if (pref.requireFurnished && !amenityOn(offer, 'isFurnished')) return false;
  if (pref.requireTwoLevel && !offer.isTwoLevel && !offer.isDuplex) return false;
  return true;
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
    pref.requireBalcony ? amenityOn(offer, 'hasBalcony') : null,
    pref.requireGarden ? amenityOn(offer, 'hasGarden') : null,
    pref.requireElevator ? amenityOn(offer, 'hasElevator') : null,
    pref.requireParking ? amenityOn(offer, 'hasParking') : null,
    pref.requireFurnished ? amenityOn(offer, 'isFurnished') : null,
    pref.requireTwoLevel ? !!(offer.isTwoLevel || offer.isDuplex) : null,
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

  const offerDistrict = offerDistrictNormalized(pref, offer);
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

  const offerDistrict = offerDistrictNormalized(pref, offer);
  if (!offerDistrict) return false;
  return districts.some((d) => d === offerDistrict);
}

function passesStructuralGate(pref: Record<string, unknown>, offer: Record<string, unknown>): boolean {
  const yearRaw = offer.yearBuilt != null ? parseInt(String(offer.yearBuilt), 10) : null;
  const year = yearRaw != null && Number.isFinite(yearRaw) ? yearRaw : null;
  const minYear = Number(pref.minYear || 0);
  if (minYear > 1900 && year != null && year < minYear) return false;

  const rooms = Number(offer.rooms ?? 0);
  const minRooms = Number(pref.minRooms || 0);
  if (minRooms > 0 && Number.isFinite(rooms) && rooms > 0 && rooms < minRooms) return false;
  const maxRooms = Number(pref.maxRooms || 0);
  if (maxRooms > 0 && Number.isFinite(rooms) && rooms > 0 && rooms > maxRooms) return false;

  const area = Number(offer.area ?? 0);
  const maxArea = Number(pref.maxArea || 0);
  if (maxArea > 0 && Number.isFinite(area) && area > maxArea) return false;

  const minArea = Number(pref.minArea || 0);
  if (minArea > 0 && Number.isFinite(area) && area > 0 && area < minArea) return false;

  const price = Number(offer.price ?? 0);
  const maxPrice = Number(pref.maxPrice || 0);
  if (maxPrice > 0 && Number.isFinite(price) && price > 0 && price > maxPrice) return false;

  return true;
}

/** Parity z aplikacją mobilną (`RadarHomeScreen.radarMatchScore`). Zwraca 0–100. */
export function calculateRadarMatchScore(pref: Record<string, unknown>, offer: Record<string, unknown>): number {
  if (!passesLocationGate(pref, offer)) return 0;
  if (pref.searchPolygon && !offerInsideSearchPolygon(pref.searchPolygon, offer)) return 0;
  if (!passesAmenityGate(offer, pref)) return 0;
  if (!passesStructuralGate(pref, offer)) return 0;

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

/* ------------------------------------------------------------------ */
/* Jeden silnik: wynik + powody (czytelne dla klienta i agenta).        */
/* ------------------------------------------------------------------ */

export type MatchReasonTone = 'good' | 'warn' | 'bad';
export type MatchReason = { tone: MatchReasonTone; label: string };
export type MatchExplanation = { score: number; reasons: MatchReason[] };

const AMENITY_LABELS: Array<[string, IntelligenceAmenityField | 'twoLevel', string]> = [
  ['requireBalcony', 'hasBalcony', 'Balkon'],
  ['requireGarden', 'hasGarden', 'Ogród'],
  ['requireElevator', 'hasElevator', 'Winda'],
  ['requireParking', 'hasParking', 'Parking'],
  ['requireFurnished', 'isFurnished', 'Umeblowane'],
  ['requireTwoLevel', 'twoLevel', 'Dwupoziomowe'],
];

function plRooms(n: number): string {
  if (n === 1) return '1 pokój';
  if (n >= 2 && n <= 4) return `${n} pokoje`;
  return `${n} pokoi`;
}

function fmtPln(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 2).replace('.', ',')} mln zł`;
  if (v >= 1000) return `${Math.round(v / 1000)} tys. zł`;
  return `${Math.round(v)} zł`;
}

/**
 * Wynik 0–100 (ten sam co `calculateRadarMatchScore`) plus krótkie powody.
 * Kolejność: najpierw to, co się zgadza, potem kompromisy.
 */
export function explainRadarMatch(
  pref: Record<string, unknown>,
  offer: Record<string, unknown>,
): MatchExplanation {
  const score = Math.round(calculateRadarMatchScore(pref, offer));
  const good: MatchReason[] = [];
  const warn: MatchReason[] = [];
  const bad: MatchReason[] = [];

  // Lokalizacja
  if (isMapMode(pref)) {
    const c = offerCoords(offer);
    if (c) {
      const d = distanceKm(Number(pref.lat), Number(pref.lng), c.lat, c.lng);
      const r = Math.max(0.1, Number(pref.radius));
      const txt = d < 1 ? `${Math.round(d * 1000)} m od wskazanego miejsca` : `${d.toFixed(1).replace('.', ',')} km od wskazanego miejsca`;
      (d <= r ? good : warn).push({ tone: d <= r ? 'good' : 'warn', label: txt });
    }
  } else if (pref.searchPolygon && offerInsideSearchPolygon(pref.searchPolygon, offer)) {
    good.push({ tone: 'good', label: 'W zaznaczonym obszarze' });
  } else {
    const districts = parseDistricts(pref);
    const od = offerDistrictNormalized(pref, offer);
    const district = String(offer.district || '').trim();
    if (districts.length && od && districts.includes(od)) {
      good.push({ tone: 'good', label: district ? `Dzielnica ${district}` : 'Wybrana dzielnica' });
    } else if (districts.length) {
      warn.push({ tone: 'warn', label: district ? `Poza wybranymi dzielnicami (${district})` : 'Dzielnica do potwierdzenia' });
    } else if (pref.city && offer.city && citiesMatch(pref.city, offer.city)) {
      good.push({ tone: 'good', label: String(offer.city) });
    }
  }

  // Cena
  const price = getCanonicalOfferPricePln(offer);
  const maxPrice = Number(pref.maxPrice || 0);
  if (maxPrice > 0 && price > 0) {
    const diff = (price - maxPrice) / maxPrice;
    if (diff <= -0.03) good.push({ tone: 'good', label: `${Math.round(-diff * 100)}% poniżej budżetu` });
    else if (diff <= 0) good.push({ tone: 'good', label: 'Mieści się w budżecie' });
    else bad.push({ tone: diff > 0.05 ? 'bad' : 'warn', label: `${fmtPln(price - maxPrice)} ponad budżet` });
  }

  // Metraż
  const area = Number(offer.area ?? 0);
  const minArea = Number(pref.minArea || 0);
  const maxArea = Number(pref.maxArea || 0);
  if (area > 0 && (minArea > 0 || maxArea > 0)) {
    if (minArea > 0 && area < minArea) warn.push({ tone: 'warn', label: `${Math.round(minArea - area)} m² mniej niż w kryteriach` });
    else good.push({ tone: 'good', label: `${Math.round(area)} m²` });
  }

  // Pokoje
  const rooms = Number(offer.rooms ?? 0);
  const minRooms = Number(pref.minRooms || 0);
  const maxRooms = Number(pref.maxRooms || 0);
  if (rooms > 0 && (minRooms > 0 || maxRooms > 0)) {
    const ok = (!minRooms || rooms >= minRooms) && (!maxRooms || rooms <= maxRooms);
    (ok ? good : warn).push({ tone: ok ? 'good' : 'warn', label: plRooms(rooms) });
  }

  // Rok budowy
  const yr = offer.yearBuilt != null ? parseInt(String(offer.yearBuilt), 10) : NaN;
  const minYear = Number(pref.minYear || 0);
  if (minYear > 1900 && Number.isFinite(yr)) {
    (yr >= minYear ? good : warn).push({ tone: yr >= minYear ? 'good' : 'warn', label: `Rok budowy ${yr}` });
  }

  // Udogodnienia
  for (const [key, field, label] of AMENITY_LABELS) {
    if (!pref[key]) continue;
    const has = field === 'twoLevel' ? !!(offer.isTwoLevel || offer.isDuplex) : amenityOn(offer, field);
    if (has) good.push({ tone: 'good', label });
    else bad.push({ tone: 'bad', label: `Brak: ${label.toLowerCase()}` });
  }

  return { score, reasons: [...good, ...warn, ...bad].slice(0, 6) };
}
