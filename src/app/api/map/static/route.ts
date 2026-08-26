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

/** Neighborhood preview: closer zoom, streets style (POI labels) + nearby service pins. */
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

  const pois = await fetchNearbyPois(lng, lat, token);
  const overlays = [
    ...pois.map((poi) => `pin-s-${makiForKind(poi.kind)}+5c6b7a(${poi.lng},${poi.lat})`),
    `pin-l+b8922e(${lng},${lat})`,
  ].join(',');

  const src = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlays}/${lng},${lat},16,0/840x520@2x?access_token=${encodeURIComponent(token)}`;
  const response = await fetch(src, { cache: 'force-cache' });
  if (!response.ok) {
    const fallback = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+b8922e(${lng},${lat})/${lng},${lat},16,0/840x520@2x?access_token=${encodeURIComponent(token)}`;
    const retry = await fetch(fallback, { cache: 'force-cache' });
    if (!retry.ok) {
      return NextResponse.json({ error: 'Nie udało się pobrać mapy.' }, { status: 502 });
    }
    const buffer = await retry.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': retry.headers.get('content-type') || 'image/png',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const buffer = await response.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': response.headers.get('content-type') || 'image/png',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
