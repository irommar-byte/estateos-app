import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Publiczny odczyt pojedynczej oferty (m.in. `public/offer-landing.html` → `/api/offers/:id`).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const offerId = Number(id);
    if (!Number.isFinite(offerId) || offerId <= 0) {
      return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
    }

    const offer = await prisma.offer.findFirst({
      where: { id: offerId, status: 'ACTIVE' },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        area: true,
        rooms: true,
        propertyType: true,
        transactionType: true,
        city: true,
        district: true,
        images: true,
      },
    });

    if (!offer) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json(offer, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (e) {
    console.error('GET /api/offers/[id]', e);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
}
