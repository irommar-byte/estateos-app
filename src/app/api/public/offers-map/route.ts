import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolvePublicMapPin } from '@/lib/location/mapPinFallback';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Publiczne piny do mapy na stronie głównej — aktywne oferty.
 * Gdy brak lat/lng w bazie, używane są przybliżone współrzędne z miasta/dzielnicy (Warszawa: centra dzielnic + jitter).
 */
export async function GET() {
  try {
    const offers = await prisma.offer.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        title: true,
        price: true,
        city: true,
        district: true,
        propertyType: true,
        lat: true,
        lng: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 400,
    });

    const payload = offers.map((o) => {
      const coords = resolvePublicMapPin({
        id: o.id,
        city: o.city,
        district: o.district,
        lat: o.lat,
        lng: o.lng,
      });
      return {
        id: o.id,
        title: o.title,
        price: o.price,
        district: o.district,
        propertyType: o.propertyType,
        lat: coords.lat,
        lng: coords.lng,
        approximate: coords.approximate,
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
    console.error('offers-map GET', e);
    return NextResponse.json({ offers: [] }, { status: 200 });
  }
}
