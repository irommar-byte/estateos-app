import { NextResponse } from 'next/server';
import { OfferStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';

const OFFER_ADMIN_STATUSES: OfferStatus[] = ['PENDING', 'ACTIVE', 'ARCHIVED', 'REJECTED', 'SOLD', 'IN_DEAL'];

export async function GET(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  try {
    const { searchParams } = new URL(req.url);
    const rawStatus = searchParams.get('status') || 'PENDING';
    const status = (OFFER_ADMIN_STATUSES.includes(rawStatus as OfferStatus) ? rawStatus : 'PENDING') as OfferStatus;

    const offers = await prisma.offer.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: { 
        user: { select: { email: true, name: true, phone: true } } 
      }
    });

    return NextResponse.json({ success: true, offers });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  try {
    const { offerId, newStatus } = await req.json();
    
    if (!offerId || !newStatus) {
      return NextResponse.json({ success: false, message: 'Brak wymaganych danych' }, { status: 400 });
    }

    const existing = await prisma.offer.findUnique({ where: { id: Number(offerId) } });

    const offer = await prisma.offer.update({
      where: { id: Number(offerId) },
      data: { status: newStatus }
    });

    console.log("MOBILE STATUS CHECK:", { before: existing?.status, after: newStatus });

    if (existing?.status !== 'ACTIVE' && newStatus === 'ACTIVE') {
      const { radarService } = await import("@/lib/services/radar.service");
      await radarService.matchNewOffer(offer);
    }

    return NextResponse.json({ success: true, offer });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
