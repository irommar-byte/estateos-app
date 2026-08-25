import { NextResponse } from 'next/server';
import { getCarOgJpeg, getOfferOgJpeg } from '@/lib/buildShareOgJpeg';

const OG_HEADERS = {
  'Content-Type': 'image/jpeg',
  'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
  'X-Content-Type-Options': 'nosniff',
};

function jpegResponse(jpeg: Buffer) {
  return new NextResponse(new Uint8Array(jpeg), {
    status: 200,
    headers: {
      ...OG_HEADERS,
      'Content-Length': String(jpeg.length),
    },
  });
}

export async function serveOfferOgJpeg(idRaw: string) {
  const id = Number(String(idRaw || '').replace(/\.jpe?g$/i, ''));
  const jpeg = await getOfferOgJpeg(id);
  if (!jpeg) {
    return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  }
  return jpegResponse(jpeg);
}

export async function serveCarOgJpeg(idRaw: string) {
  const id = Number(String(idRaw || '').replace(/\.jpe?g$/i, ''));
  const jpeg = await getCarOgJpeg(id);
  if (!jpeg) {
    return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  }
  return jpegResponse(jpeg);
}
