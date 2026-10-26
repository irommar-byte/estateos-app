import { isInsideWarsaw } from '@/lib/keiAmerDistrict';

/** Prostokąt Warszawy dla Mapboxa — wynik spoza miasta w ogóle nie wraca. */
const WARSAW_BBOX = '20.83,52.085,21.29,52.38';

export type WarsawGeocodeHit = { lat: number; lng: number; exact: boolean; label: string };

async function geocodeOnce(query: string, types: string, token: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const params = new URLSearchParams({
    access_token: token,
    language: 'pl',
    limit: '1',
    autocomplete: 'false',
    country: 'pl',
    bbox: WARSAW_BBOX,
    types,
  });
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
 * Pinezka w Warszawie dla oferty z KEI: najpierw ulica, potem osiedle, na końcu dzielnica.
 * Zwraca null, gdy nic nie leży w granicach Warszawy (lepiej bez pinezki niż z pinezką w Białymstoku).
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

  if (street) {
    const hit = await geocodeOnce([street, district, 'Warszawa'].filter(Boolean).join(', '), 'address', token);
    if (hit) return { ...hit, exact: true };
  }
  for (const place of [neighborhood, district]) {
    if (!place) continue;
    const hit = await geocodeOnce(`${place}, Warszawa`, 'neighborhood,locality,district,place', token);
    if (hit) return { ...hit, exact: false };
  }
  return null;
}

/** Trzeci człon adresu KEI to osiedle: „warszawa, praga-południe, saska kępa” → „saska kępa”. */
export function keiNeighborhoodFromAddress(address: string | null | undefined): string {
  const parts = String(address || '').split(',').map((p) => p.trim()).filter(Boolean);
  return parts[2] || '';
}
