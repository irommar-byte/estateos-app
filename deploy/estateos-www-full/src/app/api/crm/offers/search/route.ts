import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { prisma } from '@/lib/prisma';
import { resolveOfferImageUrls, resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { absolutizeMediaUrl } from '@/lib/offerShareLanding';

export const dynamic = 'force-dynamic';

function shapeOffer(offer: {
  id: number;
  title: string;
  city: string | null;
  street: string | null;
  district: string | null;
  area: unknown;
  price: unknown;
  images: unknown;
  status: string;
  userId: number;
}) {
  const imageUrls = resolveOfferImageUrls(offer).map(absolutizeMediaUrl).filter(Boolean).slice(0, 4);
  const imageUrl = absolutizeMediaUrl(resolveOfferPrimaryImage(offer)) || imageUrls[0] || null;
  return {
    id: offer.id,
    title: offer.title,
    city: offer.city || null,
    street: offer.street || null,
    district: offer.district || null,
    area: offer.area == null ? null : Number(offer.area),
    price: offer.price == null ? null : Number(offer.price),
    imageUrl,
    imageUrls,
    status: String(offer.status || 'ACTIVE'),
    ownListing: false as boolean,
  };
}

/**
 * Wyszukiwarka ofert pod prezentację CRM — bez ręcznego wpisywania ID.
 * Zakres: portfel agenta + aktywne oferty rynkowe (tytuł / miasto / ulica / #id).
 */
export async function GET(req: NextRequest) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji.' }, { status: 403 });
  }

  const qRaw = String(req.nextUrl.searchParams.get('q') || '').trim();
  const limit = Math.min(40, Math.max(8, Number(req.nextUrl.searchParams.get('limit') || 24) || 24));

  const select = {
    id: true,
    title: true,
    city: true,
    street: true,
    district: true,
    area: true,
    price: true,
    images: true,
    status: true,
    userId: true,
  } as const;

  if (!qRaw) {
    const own = await prisma.offer.findMany({
      where: {
        userId: agencyUserId,
        status: { in: ['ACTIVE', 'PENDING', 'IN_DEAL'] },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select,
    });
    return NextResponse.json({
      success: true,
      offers: own.map((row) => ({ ...shapeOffer(row), ownListing: true, linkedClientId: null })),
    });
  }

  const idExact = /^\d+$/.test(qRaw) ? Number(qRaw) : 0;
  const tokens = qRaw
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 6);

  const textOr =
    tokens.length > 0
      ? tokens.flatMap((token) => [
          { title: { contains: token } },
          { city: { contains: token } },
          { street: { contains: token } },
          { district: { contains: token } },
        ])
      : [];

  const orBranches: Array<Record<string, unknown>> = [];
  if (idExact > 0) orBranches.push({ id: idExact });
  if (textOr.length) {
    orBranches.push({ userId: agencyUserId, OR: textOr });
    orBranches.push({ status: 'ACTIVE', OR: textOr });
  } else if (idExact <= 0) {
    orBranches.push({ userId: agencyUserId });
  }

  const rows = await prisma.offer.findMany({
    where: {
      status: { in: ['ACTIVE', 'PENDING', 'IN_DEAL'] },
      OR: orBranches.length ? orBranches : [{ userId: agencyUserId }],
    },
    orderBy: { updatedAt: 'desc' },
    take: limit * 2,
    select,
  });

  const seen = new Set<number>();
  const ranked = [
    ...rows.filter((r) => r.userId === agencyUserId),
    ...rows.filter((r) => r.userId !== agencyUserId),
  ]
    .filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    })
    .slice(0, limit);

  return NextResponse.json({
    success: true,
    offers: ranked.map((row) => ({
      ...shapeOffer(row),
      ownListing: row.userId === agencyUserId,
      linkedClientId: null,
    })),
  });
}
