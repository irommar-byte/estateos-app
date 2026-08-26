import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Same-origin QR so html2canvas can snapshot the brochure without a blank PDF. */
export async function GET(req: Request) {
  const data = String(new URL(req.url).searchParams.get('data') || '').trim();
  const sizeRaw = Number(new URL(req.url).searchParams.get('size') || 240);
  const size = Number.isFinite(sizeRaw) ? Math.min(480, Math.max(80, Math.round(sizeRaw))) : 240;
  if (!data || data.length > 500) {
    return NextResponse.json({ error: 'Brak danych QR.' }, { status: 400 });
  }

  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&bgcolor=ffffff&color=141416&data=${encodeURIComponent(data)}`;
  const response = await fetch(src, { cache: 'force-cache' });
  if (!response.ok) {
    return NextResponse.json({ error: 'Nie udało się zbudować QR.' }, { status: 502 });
  }

  const buffer = await response.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': response.headers.get('content-type') || 'image/png',
      'Cache-Control': 'public, max-age=86400, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
