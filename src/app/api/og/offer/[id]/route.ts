import { NextResponse } from 'next/server';
import { serveOfferOgJpeg } from '@/lib/serveShareOg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  return serveOfferOgJpeg(id);
}

export async function HEAD(_req: Request, { params }: Params) {
  const { id } = await params;
  const res = await serveOfferOgJpeg(id);
  if (!res.ok) return res;
  return new NextResponse(null, { status: 200, headers: res.headers });
}
