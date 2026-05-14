import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseOfferImages(raw: string | null): string[] {
  if (!raw) return [];
  const s = raw.trim();
  if (!s) return [];
  try {
    const j = JSON.parse(s) as unknown;
    if (Array.isArray(j)) return j.map(String).filter(Boolean);
  } catch {
    /* JSON nie-tablica — traktuj jak listę rozdzieloną przecinkami */
  }
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Publiczny katalog www — aktywne oferty (bez wrażliwych pól).
 */
export async function GET() {
  try {
    const offers = await prisma.offer.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        title: true,
        price: true,
        area: true,
        city: true,
        district: true,
        propertyType: true,
        transactionType: true,
        images: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });

    const payload = offers.map((o) => {
      const urls = parseOfferImages(o.images);
      return {
        id: o.id,
        title: o.title,
        price: o.price,
        area: o.area,
        city: o.city,
        district: o.district,
        propertyType: o.propertyType,
        transactionType: o.transactionType,
        image: urls[0] ?? null,
      };
    });

    return NextResponse.json(
      { offers: payload },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      },
    );
  } catch (e) {
    console.error('offers-catalog GET', e);
    return NextResponse.json({ offers: [] }, { status: 200 });
  }
}
