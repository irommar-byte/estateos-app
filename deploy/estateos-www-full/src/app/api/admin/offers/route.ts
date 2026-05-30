import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { extractVerificationMeta, setVerificationStatusInDescription, type OfferVerificationStatus } from '@/lib/offerVerification';
import { completeAdminOfferApproval, adminForceArchiveOffer, adminReactivateArchivedOffer } from '@/lib/offerPublication';
import { markProfilePromoCardUsed } from '@/lib/profilePromoCards';
import { deleteOfferCompletely } from '@/lib/deleteOfferCompletely';

type AdminUser = { id: number; role: string } | null;

async function requireAdmin(): Promise<AdminUser> {
  const nextAuth = await getServerSession(authOptions);
  const nextAuthEmail = String(nextAuth?.user?.email || '').trim().toLowerCase();
  if (nextAuthEmail) {
    const user = await prisma.user.findUnique({
      where: { email: nextAuthEmail },
      select: { id: true, role: true },
    });
    if (user?.role === 'ADMIN') return user;
  }

  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get('estateos_session')?.value ||
    cookieStore.get('luxestate_user')?.value ||
    null;
  if (!sessionToken) return null;

  const session = decryptSession(sessionToken);
  const email = String(session?.email || '').trim().toLowerCase();
  if (!email) return null;

  return prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
}

function normalizeStatus(rawStatus: unknown): 'PENDING' | 'ACTIVE' | 'ARCHIVED' | 'REJECTED' {
  const s = String(rawStatus || '').trim().toUpperCase();
  if (s === 'ACTIVE') return 'ACTIVE';
  if (s === 'ARCHIVED') return 'ARCHIVED';
  if (s === 'REJECTED') return 'REJECTED';
  return 'PENDING';
}

function normalizeVerificationStatus(rawStatus: unknown): OfferVerificationStatus | null {
  const s = String(rawStatus || '').trim().toUpperCase();
  if (s === 'VERIFIED') return 'VERIFIED';
  if (s === 'PENDING_REVIEW') return 'PENDING_REVIEW';
  if (s === 'UNVERIFIED') return 'UNVERIFIED';
  return null;
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const offers = await prisma.offer.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' } });
    const enriched = offers.map((offer) => {
      const { verification } = extractVerificationMeta(offer.description);
      return {
        ...offer,
        verificationStatus: verification.status,
      };
    });
    return NextResponse.json({ success: true, offers: enriched });
  } catch (error) { return NextResponse.json({ success: false, error: String(error) }, { status: 500 }); }
}

export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, status, verificationStatus } = await req.json();
    const normalizedStatus = normalizeStatus(status);
    const normalizedVerificationStatus = normalizeVerificationStatus(verificationStatus);

    // === SILNIK ALERTÓW - tylko przy zmianie na ACTIVE ===
    const existing = await prisma.offer.findUnique({ where: { id: Number(id) } });

    const nextDescription = normalizedVerificationStatus
      ? setVerificationStatusInDescription(existing?.description || '', normalizedVerificationStatus)
      : undefined;

    if (normalizedStatus === 'ARCHIVED') {
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Oferta nie istnieje.' }, { status: 404 });
      }

      await adminForceArchiveOffer(Number(id));

      const updated = await prisma.offer.findUnique({ where: { id: Number(id) } });
      return NextResponse.json({ success: true, offer: updated });
    }

    if (normalizedStatus === 'ACTIVE') {
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Oferta nie istnieje.' }, { status: 404 });
      }

      const wasArchived = String(existing.status).toUpperCase() === 'ARCHIVED';

      if (wasArchived) {
        const reactivation = await adminReactivateArchivedOffer({
          offerId: Number(id),
          ownerUserId: Number(existing.userId),
        });
        if (!reactivation.ok) {
          return NextResponse.json(
            { success: false, error: reactivation.message, code: reactivation.code },
            { status: 409 },
          );
        }

        const updated = await prisma.offer.update({
          where: { id: Number(id) },
          data: {
            status: 'ACTIVE',
            expiresAt: reactivation.endsAt,
            ...(nextDescription !== undefined ? { description: nextDescription } : {}),
          },
        });

        return NextResponse.json({ success: true, offer: updated });
      }

      const approval = await completeAdminOfferApproval({
        offerId: Number(id),
        ownerUserId: Number(existing.userId),
        onFreeFirstCouponUsed: markProfilePromoCardUsed,
      });

      if (!approval.ok) {
        return NextResponse.json(
          { success: false, error: approval.message, code: approval.code },
          { status: 409 },
        );
      }

      const updated = await prisma.offer.update({
        where: { id: Number(id) },
        data: {
          status: 'ACTIVE',
          expiresAt: approval.endsAt,
          ...(nextDescription !== undefined ? { description: nextDescription } : {}),
        },
      });

      return NextResponse.json({ success: true, offer: updated });
    }

    const updated = await prisma.offer.update({
      where: { id: Number(id) },
      data: {
        status: normalizedStatus,
        ...(nextDescription !== undefined ? { description: nextDescription } : {}),
      },
    });

    return NextResponse.json({ success: true, offer: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

    const offerId = Number(id);
    const existing = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Oferta nie istnieje.' }, { status: 404 });
    }
    if (String(existing.status).toUpperCase() !== 'ARCHIVED') {
      return NextResponse.json(
        { success: false, error: 'Trwałe usuwanie dostępne tylko dla ofert zarchiwizowanych.' },
        { status: 409 }
      );
    }

    const result = await deleteOfferCompletely(offerId);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, deleted: true, offerId: result.deletedId });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
