import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function mapboxToken(): string {
  return (
    process.env.MAPBOX_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ||
    ''
  );
}

/** Static Mapbox neighborhood preview (gold pin) for the print/PDF brochure. */
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

  const overlay = `pin-l+b8922e(${lng},${lat})`;
  const src = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${overlay}/${lng},${lat},14,0/840x520@2x?access_token=${encodeURIComponent(token)}`;
  const response = await fetch(src, { cache: 'force-cache' });
  if (!response.ok) {
    return NextResponse.json({ error: 'Nie udało się pobrać mapy.' }, { status: 502 });
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
