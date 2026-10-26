import { isInsideWarsaw, resolveWarsawDistrict, warsawDistrictNames, normalizeKeiPlaceName } from '@/lib/keiAmerDistrict';
import { canonicalizeCity, inferCityFromMapboxFeature, inferStrictDistrictFromMapboxFeature } from '@/lib/location/locationCatalog';

/** Środki dzielnic Warszawy i promień, w którym musi leżeć znaleziona ulica (km). */
const WARSAW_DISTRICT_CENTRES: Record<string, { lat: number; lng: number; radiusKm: number }> = {
  'Bemowo': { lat: 52.254, lng: 20.911, radiusKm: 5.5 },
  'Białołęka': { lat: 52.32, lng: 20.99, radiusKm: 8 },
  'Bielany': { lat: 52.285, lng: 20.94, radiusKm: 5 },
  'Mokotów': { lat: 52.193, lng: 21.035, radiusKm: 5 },
  'Ochota': { lat: 52.212, lng: 20.972, radiusKm: 4 },
  'Praga-Południe': { lat: 52.239, lng: 21.085, radiusKm: 4.5 },
  'Praga-Północ': { lat: 52.257, lng: 21.035, radiusKm: 3.5 },
  'Rembertów': { lat: 52.259, lng: 21.163, radiusKm: 4 },
  'Śródmieście': { lat: 52.231, lng: 21.012, radiusKm: 3.5 },
  'Targówek': { lat: 52.28, lng: 21.055, radiusKm: 4.5 },
  'Ursus': { lat: 52.195, lng: 20.884, radiusKm: 3.5 },
  'Ursynów': { lat: 52.148, lng: 21.045, radiusKm: 5 },
  'Wawer': { lat: 52.196, lng: 21.177, radiusKm: 8 },
  'Wesoła': { lat: 52.25, lng: 21.224, radiusKm: 5 },
  'Wilanów': { lat: 52.165, lng: 21.09, radiusKm: 5 },
  'Włochy': { lat: 52.194, lng: 20.94, radiusKm: 4.5 },
  'Wola': { lat: 52.236, lng: 20.965, radiusKm: 4.5 },
  'Żoliborz': { lat: 52.269, lng: 20.985, radiusKm: 3.5 },
};

/** Prostokąt Warszawy dla Mapboxa — wynik spoza miasta w ogóle nie wraca. */
const WARSAW_BBOX = '20.83,52.085,21.29,52.38';
/** Punkty „Warszawa” (środek miasta) — Mapbox zwraca je, gdy nie zna miejsca. To nie jest trafienie. */
const WARSAW_CENTRES = [
  { lat: 52.23072, lng: 21.01632 },
  { lat: 52.2297, lng: 21.0122 },
];

export type WarsawGeocodeHit = { lat: number; lng: number; exact: boolean; label: string };
type Point = { lat: number; lng: number };

function distanceKm(a: Point, b: Point): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function isGenericWarsawCentre(p: Point): boolean {
  return WARSAW_CENTRES.some((c) => distanceKm(c, p) < 0.3);
}

type MapboxFeature = { center?: number[]; place_name?: string; context?: Array<{ id?: string; text?: string }> };

async function geocodeCandidates(query: string, types: string, token: string, proximity?: Point | null): Promise<MapboxFeature[]> {
  const params = new URLSearchParams({
    access_token: token,
    language: 'pl',
    limit: '5',
    autocomplete: 'false',
    country: 'pl',
    bbox: WARSAW_BBOX,
    types,
  });
  if (proximity) params.set('proximity', `${proximity.lng},${proximity.lat}`);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`;
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload?.features) ? payload.features : [];
  } catch {
    return [];
  }
}

/**
 * Wynik musi leżeć w Warszawie (nie w Sulejówku czy Markach z ulicą o tej samej nazwie),
 * w promieniu swojej dzielnicy, a jeśli Mapbox podaje dzielnicę — dokładnie tej z KEI.
 */
function acceptFeature(feature: MapboxFeature, district: string, allowCentre: boolean): (Point & { label: string }) | null {
  const lng = Number(feature?.center?.[0]);
  const lat = Number(feature?.center?.[1]);
  if (!isInsideWarsaw(lat, lng)) return null;
  const point = { lat, lng };
  if (!allowCentre && isGenericWarsawCentre(point)) return null;
  const city = canonicalizeCity(inferCityFromMapboxFeature(feature));
  if (city && city !== 'Warszawa') return null;
  const centre = WARSAW_DISTRICT_CENTRES[district];
  if (centre && distanceKm(point, centre) > centre.radiusKm) return null;
  const featureDistrict = inferStrictDistrictFromMapboxFeature('Warszawa', feature);
  if (district && featureDistrict && featureDistrict !== district) return null;
  return { lat, lng, label: String(feature?.place_name || '') };
}

export type WarsawGeocodeResult = WarsawGeocodeHit & { neighborhoodVerified: boolean; source: 'street' | 'neighborhood' | 'district' };

/**
 * Pinezka w Warszawie dla oferty z KEI: ulica (sprawdzona: Warszawa + właściwa dzielnica),
 * potem osiedle, na końcu środek dzielnicy. null tylko, gdy nie znamy nawet dzielnicy.
 */
export async function geocodeWarsawPlace(input: {
  street?: string | null;
  neighborhood?: string | null;
  district?: string | null;
}): Promise<WarsawGeocodeResult | null> {
  const token = String(process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '').trim();
  const street = String(input.street || '').trim();
  const neighborhood = String(input.neighborhood || '').trim();
  const district = resolveWarsawDistrict(input.district) || '';
  const allowCentre = district === 'Śródmieście';
  const centre = WARSAW_DISTRICT_CENTRES[district] || null;

  let area: (Point & { label: string }) | null = null;
  if (token && neighborhood) {
    for (const feature of await geocodeCandidates(`${neighborhood}, Warszawa`, 'neighborhood,locality', token, centre)) {
      area = acceptFeature(feature, district, allowCentre);
      if (area) break;
    }
  }
  if (token && street) {
    for (const feature of await geocodeCandidates(`${street}, Warszawa`, 'address', token, area || centre)) {
      const hit = acceptFeature(feature, district, allowCentre);
      if (hit && (!area || distanceKm(hit, area) <= 4)) {
        return { ...hit, exact: true, neighborhoodVerified: Boolean(area), source: 'street' };
      }
    }
  }
  if (area) return { ...area, exact: false, neighborhoodVerified: true, source: 'neighborhood' };
  if (centre) return { lat: centre.lat, lng: centre.lng, exact: false, label: `${district}, Warszawa`, neighborhoodVerified: false, source: 'district' };
  return null;
}

/**
 * KEI czasem zapisało adres z zepsutymi polskimi literami („praga-po?udnie”, „garwoli?ska”).
 * Człon z „?” dopasowujemy do nazw dzielnic (znak „?” = dowolna litera), a w pozostałych usuwamy „?”.
 */
const dropNonLatin1 = (value: string) => [...value].filter((ch) => ch.charCodeAt(0) <= 0xff).join('');

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function repairKeiAddress(address: string | null | undefined): string {
  const parts = decodeEntities(String(address || '')).split(',').map((p) => p.trim());
  return parts
    .map((part) => {
      // Stare migawki gubiły litery spoza Latin-1 („ródmiecie pónocne” = „śródmieście północne”).
      const lowered = part.toLocaleLowerCase('pl-PL');
      const dropped = warsawDistrictNames().find(
        (name) => !part.includes('?') && dropNonLatin1(name.toLocaleLowerCase('pl-PL')) === lowered && name.toLocaleLowerCase('pl-PL') !== lowered,
      );
      if (dropped) return dropped.toLocaleLowerCase('pl-PL');
      if (!part.includes('?')) return part;
      const pattern = new RegExp(
        `^${part
          .split('?')
          .map((segment) => normalizeKeiPlaceName(segment).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('.')}$`,
      );
      const district = warsawDistrictNames().find((name) => pattern.test(normalizeKeiPlaceName(name)));
      return district ? district.toLowerCase() : part.replace(/\?/g, '');
    })
    .join(', ');
}

export function keiNeighborhoodFromAddress(address: string | null | undefined): string {
  return String(address || '').split(',').map((p) => p.trim()).filter(Boolean)[2] || '';
}

export function keiStreetFromAddress(address: string | null | undefined): string {
  return String(address || '').split(',').map((p) => p.trim()).filter(Boolean)[3] || '';
}

/** „śródmieście północne” → „Śródmieście Północne”. */
export function titleCasePlace(value: string): string {
  return value
    .split(/(\s+|-)/)
    .map((w) => (/^\s+$|^-$/.test(w) ? w : w.charAt(0).toLocaleUpperCase('pl-PL') + w.slice(1)))
    .join('');
}

export { resolveWarsawDistrict };
