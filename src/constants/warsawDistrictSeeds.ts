/** Zarodki Voronoi dla dzielnic Warszawy — współdzielone z kreatorem oferty i locationEcosystem. */
export const WARSZAWA_DISTRICT_SEEDS: Record<string, Array<{ lat: number; lng: number }>> = {
  'Białołęka': [
    { lat: 52.3450, lng: 20.9750 },
    { lat: 52.3550, lng: 20.9850 },
    { lat: 52.3500, lng: 21.0200 },
    { lat: 52.3580, lng: 21.0450 },
    { lat: 52.3650, lng: 21.0300 },
    { lat: 52.3200, lng: 20.9850 },
    { lat: 52.3100, lng: 20.9800 },
    { lat: 52.3050, lng: 21.0050 },
  ],
  Targówek: [
    { lat: 52.3000, lng: 21.0430 },
    { lat: 52.2920, lng: 21.0500 },
    { lat: 52.2950, lng: 21.0700 },
    { lat: 52.2820, lng: 21.0750 },
  ],
  'Praga-Północ': [
    { lat: 52.2600, lng: 21.0400 },
    { lat: 52.2660, lng: 21.0550 },
    { lat: 52.2540, lng: 21.0350 },
  ],
  'Praga-Południe': [
    { lat: 52.2470, lng: 21.0750 },
    { lat: 52.2450, lng: 21.0950 },
    { lat: 52.2380, lng: 21.0700 },
    { lat: 52.2280, lng: 21.1050 },
    { lat: 52.2540, lng: 21.0820 },
  ],
  Mokotów: [
    { lat: 52.1980, lng: 21.0190 },
    { lat: 52.1850, lng: 21.0250 },
    { lat: 52.1900, lng: 21.0450 },
    { lat: 52.1950, lng: 21.0050 },
  ],
  Wola: [
    { lat: 52.2380, lng: 20.9580 },
    { lat: 52.2260, lng: 20.9700 },
    { lat: 52.2480, lng: 20.9500 },
  ],
  Bielany: [
    { lat: 52.2900, lng: 20.9450 },
    { lat: 52.3000, lng: 20.9100 },
    { lat: 52.2800, lng: 20.9550 },
  ],
  Bemowo: [
    { lat: 52.2520, lng: 20.9100 },
    { lat: 52.2400, lng: 20.8950 },
    { lat: 52.2620, lng: 20.9050 },
    { lat: 52.2230, lng: 20.9040 },
  ],
  Ursynów: [
    { lat: 52.1480, lng: 21.0450 },
    { lat: 52.1380, lng: 21.0300 },
    { lat: 52.1600, lng: 21.0500 },
  ],
  Wawer: [
    { lat: 52.2200, lng: 21.1400 },
    { lat: 52.1950, lng: 21.1850 },
    { lat: 52.2050, lng: 21.1700 },
    { lat: 52.2300, lng: 21.1550 },
  ],
  Śródmieście: [
    { lat: 52.2310, lng: 21.0120 },
    { lat: 52.2400, lng: 21.0080 },
  ],
  Ochota: [
    { lat: 52.2110, lng: 20.9850 },
    { lat: 52.2200, lng: 20.9900 },
  ],
  Włochy: [
    { lat: 52.1960, lng: 20.9450 },
    { lat: 52.1860, lng: 20.9250 },
    { lat: 52.1785, lng: 20.9850 },
  ],
  Ursus: [{ lat: 52.1960, lng: 20.8860 }],
  Wilanów: [
    { lat: 52.1660, lng: 21.0900 },
    { lat: 52.1550, lng: 21.0950 },
  ],
  Żoliborz: [
    { lat: 52.2730, lng: 20.9840 },
    { lat: 52.2680, lng: 20.9900 },
  ],
  Rembertów: [{ lat: 52.2650, lng: 21.1900 }],
  Wesoła: [
    { lat: 52.2470, lng: 21.2300 },
    { lat: 52.2550, lng: 21.2200 },
  ],
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function minDistanceToWarsawDistrictSeeds(
  district: string,
  lat: number,
  lng: number,
): number {
  const seeds = WARSZAWA_DISTRICT_SEEDS[district];
  if (!seeds?.length || !Number.isFinite(lat) || !Number.isFinite(lng)) return Infinity;
  return Math.min(...seeds.map((seed) => haversineKm(lat, lng, seed.lat, seed.lng)));
}

/** Najbliższa dzielnica administracyjna Warszawy dla pinezki (Voronoi po zarodkach). */
export function inferWarsawDistrictFromCoordinates(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let bestDistrict: string | null = null;
  let bestKm = Infinity;
  for (const [district, seeds] of Object.entries(WARSZAWA_DISTRICT_SEEDS)) {
    const km = Math.min(...seeds.map((seed) => haversineKm(lat, lng, seed.lat, seed.lng)));
    if (km < bestKm) {
      bestKm = km;
      bestDistrict = district;
    }
  }
  return bestDistrict;
}
