import { NextResponse } from 'next/server';
import { getOfferOgJpeg } from '@/lib/buildShareOgJpeg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number {
  const cleaned = String(raw || '').replace(/\.jpe?g$/i, '');
  return Number(cleaned);
}

async function serve(idRaw: string) {
  const id = parseId(idRaw);
  const jpeg = await getOfferOgJpeg(id);
  if (!jpeg) {
    return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(jpeg), {
    status: 200,
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': String(jpeg.length),
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  return serve(id);
}

export async function HEAD(_req: Request, { params }: Params) {
  const { id } = await params;
  const res = await serve(id);
  if (!res.ok) return res;
  return new NextResponse(null, { status: 200, headers: res.headers });
}
