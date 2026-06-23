import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { isAgencyManagedOffer } from '@/lib/offerAgencyManagement';
import { resolveWebUserId } from '@/lib/webSessionAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 });
  }

  const offers = await prisma.offer.findMany({
    where: { originalOwnerUserId: userId, managementStatus: 'AGENCY_MANAGED' },
    orderBy: { updatedAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, companyName: true, image: true } },
      priceHistory: { orderBy: { recordedAt: 'desc' }, take: 3 },
    },
  });

  const leadByOffer = await prisma.leadTransfer.findMany({
    where: {
      ownerId: userId,
      offerId: { in: offers.map((o) => o.id) },
      status: 'ACCEPTED',
    },
    orderBy: { updatedAt: 'desc' },
  });
  const leadMap = new Map<number, (typeof leadByOffer)[0]>();
  for (const l of leadByOffer) {
    if (!leadMap.has(l.offerId)) leadMap.set(l.offerId, l);
  }

  return NextResponse.json({
    success: true,
    offers: offers.map((o) => ({
      id: o.id,
      title: o.title,
      price: o.price,
      pricePln: o.pricePln,
      city: o.city,
      district: o.district,
      status: o.status,
      managementStatus: o.managementStatus,
      imageUrl: resolveOfferPrimaryImage(o),
      updatedAt: o.updatedAt.toISOString(),
      agency: {
        id: o.user.id,
        name: o.user.companyName || o.user.name,
        image: o.user.image,
      },
      commissionRate: leadMap.get(o.id)?.commissionRate ?? null,
      commissionTerms: leadMap.get(o.id)?.commissionTerms ?? null,
      acceptedAt: leadMap.get(o.id)?.updatedAt?.toISOString() ?? null,
      recentPriceChanges: o.priceHistory.map((p) => ({
        price: p.price,
        recordedAt: p.recordedAt.toISOString(),
        changeType: p.changeType,
      })),
      readOnly: isAgencyManagedOffer(o),
    })),
  });
}
