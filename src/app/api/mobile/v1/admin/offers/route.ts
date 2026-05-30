import { NextResponse } from 'next/server';
import { OfferStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { deleteOfferCompletely } from '@/lib/deleteOfferCompletely';
import { completeAdminOfferApproval } from '@/lib/offerPublication';
import { markProfilePromoCardUsed } from '@/lib/profilePromoCards';

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
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Oferta nie istnieje.' }, { status: 404 });
    }

    const normalizedStatus = String(newStatus || '').trim().toUpperCase();

    if (normalizedStatus === 'ACTIVE') {
      const approval = await completeAdminOfferApproval({
        offerId: Number(offerId),
        ownerUserId: Number(existing.userId),
        onFreeFirstCouponUsed: markProfilePromoCardUsed,
      });

      if (!approval.ok) {
        return NextResponse.json(
          { success: false, message: approval.message, code: approval.code },
          { status: 409 },
        );
      }

      const offer = await prisma.offer.update({
        where: { id: Number(offerId) },
        data: { status: 'ACTIVE', expiresAt: approval.endsAt },
      });

      return NextResponse.json({ success: true, offer });
    }

    const offer = await prisma.offer.update({
      where: { id: Number(offerId) },
      data: { status: newStatus },
    });

    return NextResponse.json({ success: true, offer });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json().catch(() => ({}));
    const offerId = Number(body?.offerId);
    if (!Number.isFinite(offerId) || offerId <= 0) {
      return NextResponse.json({ success: false, message: 'Brak poprawnego ID oferty.' }, { status: 400 });
    }

    const existing = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Oferta nie istnieje.' }, { status: 404 });
    }
    if (String(existing.status).toUpperCase() !== 'ARCHIVED') {
      return NextResponse.json(
        { success: false, message: 'Trwałe usuwanie dostępne tylko dla ofert zarchiwizowanych.' },
        { status: 409 }
      );
    }

    const result = await deleteOfferCompletely(offerId);
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, deleted: true, offerId: result.deletedId });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
