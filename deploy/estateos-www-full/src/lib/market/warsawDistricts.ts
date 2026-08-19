import { inferDistrictFromStreet } from '@/lib/location/locationCatalog';
import { WARSAW_CITY } from '@/lib/market/constants';

export const WARSAW_DISTRICT_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  Bemowo: { lat: 52.254, lng: 20.91 },
  Białołęka: { lat: 52.33, lng: 21.04 },
  Bielany: { lat: 52.29, lng: 20.94 },
  Mokotów: { lat: 52.193, lng: 21.029 },
  Ochota: { lat: 52.211, lng: 20.985 },
  'Praga-Południe': { lat: 52.247, lng: 21.09 },
  'Praga-Północ': { lat: 52.26, lng: 21.04 },
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
};

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function closestWarsawDistrict(lat: number, lng: number): string {
  let best = 'Śródmieście';
  let min = Infinity;
  for (const [name, c] of Object.entries(WARSAW_DISTRICT_CENTROIDS)) {
    const km = haversineKm(lat, lng, c.lat, c.lng);
    if (km < min) {
      min = km;
      best = name;
    }
  }
  return best;
}

export function resolveWarsawDistrict(opts: {
  street?: string | null;
  lat?: number | null;
  lng?: number | null;
}): string | null {
  const fromStreet = inferDistrictFromStreet(WARSAW_CITY, opts.street);
  if (fromStreet) return fromStreet;
  if (opts.lat != null && opts.lng != null && Number.isFinite(opts.lat) && Number.isFinite(opts.lng)) {
    return closestWarsawDistrict(opts.lat, opts.lng);
  }
  return null;
}

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  return haversineKm(aLat, aLng, bLat, bLng) * 1000;
}
