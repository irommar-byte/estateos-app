import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function mapboxToken(): string {
  return (
    process.env.MAPBOX_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ||
    ''
  );
}

type PoiKind = 'rail' | 'bus' | 'shop';

type NearbyPoi = {
  lng: number;
  lat: number;
  kind: PoiKind;
};

function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (a.lat - b.lat) * 111.32;
  const dLng = (a.lng - b.lng) * 111.32 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

function makiForKind(kind: PoiKind): string {
  if (kind === 'rail') return 'rail';
  if (kind === 'bus') return 'bus';
  return 'shop';
}

async function fetchNearbyPois(lng: number, lat: number, token: string): Promise<NearbyPoi[]> {
  const queries: Array<[string, PoiKind]> = [
    ['metro', 'rail'],
    ['stacja metra', 'rail'],
    ['przystanek', 'bus'],
    ['supermarket', 'shop'],
    ['sklep', 'shop'],
    ['apteka', 'shop'],
  ];

  const batches = await Promise.all(
    queries.map(async ([query, kind]) => {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?proximity=${lng},${lat}&types=poi&limit=3&language=pl&access_token=${encodeURIComponent(token)}`;
      try {
        const response = await fetch(url, { cache: 'force-cache' });
        if (!response.ok) return [] as NearbyPoi[];
        const json = (await response.json()) as {
          features?: Array<{ center?: [number, number] }>;
        };
        return (json.features || [])
          .map((feature) => {
            const center = feature.center;
            if (!center || center.length < 2) return null;
            return { lng: center[0], lat: center[1], kind } satisfies NearbyPoi;
          })
          .filter((item): item is NearbyPoi => Boolean(item));
      } catch {
        return [] as NearbyPoi[];
      }
    }),
  );

  const listing = { lat, lng };
  const seen = new Set<string>();
  const picked: NearbyPoi[] = [];
  for (const poi of batches.flat()) {
    const km = distKm(listing, poi);
    if (km < 0.05 || km > 1.4) continue;
    const key = `${poi.kind}:${poi.lat.toFixed(4)},${poi.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(poi);
    if (picked.length >= 6) break;
  }
  return picked;
}

function imageResponse(buffer: ArrayBuffer, contentType: string | null) {
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType || 'image/png',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function fetchMapImage(...urls: string[]) {
  for (const url of urls) {
    const response = await fetch(url, { cache: 'force-cache' });
    if (response.ok) return imageResponse(await response.arrayBuffer(), response.headers.get('content-type'));
  }
  return NextResponse.json({ error: 'Nie udało się pobrać mapy.' }, { status: 502 });
}

/**
 * Domyślnie: okolica (ulice, punkty usług w pobliżu).
 * `styl=teren`: zdjęcie satelitarne z ulicami — teren, zabudowa, zieleń i dokładne położenie (ofertówka).
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'Niepoprawne współrzędne.' }, { status: 400 });
  }

  const token = mapboxToken();
  if (!token) {
    return NextResponse.json({ error: 'Brak tokenu mapy.' }, { status: 503 });
  }
  const key = encodeURIComponent(token);

  if (params.get('styl') === 'teren') {
    const pin = `pin-l+e8452c(${lng},${lat})`;
    return fetchMapImage(
      `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${pin}/${lng},${lat},16.3,0/800x640@2x?access_token=${key}`,
    );
  }

  const pois = await fetchNearbyPois(lng, lat, token);
  const overlays = [
    ...pois.map((poi) => `pin-s-${makiForKind(poi.kind)}+5c6b7a(${poi.lng},${poi.lat})`),
    `pin-l+b8922e(${lng},${lat})`,
  ].join(',');
  return fetchMapImage(
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlays}/${lng},${lat},16,0/840x520@2x?access_token=${key}`,
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+b8922e(${lng},${lat})/${lng},${lat},16,0/840x520@2x?access_token=${key}`,
  );
}
