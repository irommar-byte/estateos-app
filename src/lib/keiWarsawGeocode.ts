import { isInsideWarsaw, resolveWarsawDistrict, warsawDistrictNames, normalizeKeiPlaceName } from '@/lib/keiAmerDistrict';

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

async function geocodeOnce(
  query: string,
  types: string,
  token: string,
  proximity?: Point | null,
): Promise<(Point & { label: string }) | null> {
  const params = new URLSearchParams({
    access_token: token,
    language: 'pl',
    limit: '1',
    autocomplete: 'false',
    country: 'pl',
    bbox: WARSAW_BBOX,
    types,
  });
  if (proximity) params.set('proximity', `${proximity.lng},${proximity.lat}`);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`;
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return null;
    const payload = await response.json();
    const feature = Array.isArray(payload?.features) ? payload.features[0] : null;
    const lng = Number(feature?.center?.[0]);
    const lat = Number(feature?.center?.[1]);
    if (!isInsideWarsaw(lat, lng)) return null;
    return { lat, lng, label: String(feature?.place_name || '') };
  } catch {
    return null;
  }
}

/**
 * Pinezka w Warszawie dla oferty z KEI.
 * 1) okolica (osiedle, potem dzielnica) — punkt odniesienia; „środek Warszawy” się nie liczy,
 * 2) ulica szukana obok tej okolicy (w Warszawie jest kilka ulic o tej samej nazwie) — max 5 km od niej.
 * Zwraca null, gdy nic sensownego nie leży w Warszawie (lepiej bez pinezki niż z pinezką w złym miejscu).
 */
export async function geocodeWarsawPlace(input: {
  street?: string | null;
  neighborhood?: string | null;
  district?: string | null;
}): Promise<WarsawGeocodeHit | null> {
  const token = String(process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '').trim();
  if (!token) return null;
  const street = String(input.street || '').trim();
  const neighborhood = String(input.neighborhood || '').trim();
  const district = String(input.district || '').trim();
  const allowCentre = normalizeKeiPlaceName(district) === 'srodmiescie';

  let area: (Point & { label: string }) | null = null;
  const areaQueries = [
    neighborhood ? `${neighborhood}, ${district ? `${district}, ` : ''}Warszawa` : '',
    district ? `${district}, Warszawa` : '',
  ].filter(Boolean);
  for (const query of areaQueries) {
    const hit = await geocodeOnce(query, 'neighborhood,locality,district', token);
    if (hit && (allowCentre || !isGenericWarsawCentre(hit))) {
      area = hit;
      break;
    }
  }

  if (street) {
    const hit = await geocodeOnce(`${street}, Warszawa`, 'address', token, area);
    const plausible = hit && (allowCentre || !isGenericWarsawCentre(hit)) && (!area || distanceKm(hit, area) <= 5);
    if (hit && plausible) return { ...hit, exact: true };
  }
  return area ? { ...area, exact: false } : null;
}

/**
 * KEI czasem zapisało adres z zepsutymi polskimi literami („praga-po?udnie”, „garwoli?ska”).
 * Człon z „?” dopasowujemy do nazw dzielnic (znak „?” = dowolna litera), a w pozostałych usuwamy „?”.
 */
export function repairKeiAddress(address: string | null | undefined): string {
  const parts = String(address || '').split(',').map((p) => p.trim());
  return parts
    .map((part) => {
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
