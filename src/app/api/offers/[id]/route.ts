import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Publiczny odczyt pojedynczej oferty (strona `/o/:id`, legacy `public/offer-landing.html`).
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
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            companyName: true,
            buyerType: true,
            role: true,
          },
        },
      },
    });

    if (!offer) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const { user, ...rest } = offer;
    const displayName =
      (user.companyName && user.companyName.trim()) || user.name?.trim() || `Właściciel #${user.id}`;
    const seller = {
      id: user.id,
      displayName,
      image: user.image,
      companyName: user.companyName,
      buyerType: user.buyerType,
      role: user.role,
      profileHref: `/profil/${user.id}`,
      isAgency: user.buyerType === 'agency' || Boolean(user.companyName && user.companyName.trim()),
    };

    return NextResponse.json({ ...rest, seller }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (e) {
    console.error('GET /api/offers/[id]', e);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
}
