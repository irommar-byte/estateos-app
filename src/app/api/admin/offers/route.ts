import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { extractVerificationMeta, setVerificationStatusInDescription, type OfferVerificationStatus } from '@/lib/offerVerification';
import { activateOfferPublication, getPublicationQuote } from '@/lib/offerPublication';
import { clearPendingPublication, readPendingPublication } from '@/lib/offerPendingPublication';
import { markProfilePromoCardUsed } from '@/lib/profilePromoCards';

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

    const updated = await prisma.offer.update({
      where: { id: Number(id) },
      data: {
        status: normalizedStatus,
        ...(nextDescription !== undefined ? { description: nextDescription } : {}),
      },
    });

    console.log("STATUS CHECK:", { before: existing?.status, after: normalizedStatus });

    if (existing?.status !== 'ACTIVE' && normalizedStatus === 'ACTIVE') {
      // If the offer was submitted with a pending publication choice (WWW flow),
      // consume the chosen redemption now and make the offer visible on the market.
      try {
        const pending = await readPendingPublication(Number(id));
        if (pending?.kind) {
          const quote = await getPublicationQuote({
            userId: Number(updated.userId),
            offerId: Number(updated.id),
            action: 'ACTIVATE',
          });
          const txId = pending.kind === 'PLUS_PAID' ? String(pending.iapTransactionId || '').trim() : '';
          const activation = await activateOfferPublication({
            userId: Number(updated.userId),
            offerId: Number(updated.id),
            kind: pending.kind,
            iapTransactionId: pending.kind === 'PLUS_PAID' ? txId : null,
            iapProductId: quote.productId,
          });
          if (pending.bonusCouponId && pending.kind === 'FREE_FIRST') {
            await markProfilePromoCardUsed(Number(updated.userId), pending.bonusCouponId);
          }
          await clearPendingPublication(Number(updated.id));
          // Make sure updated response carries expiresAt.
          (updated as any).expiresAt = activation.endsAt;
        }
      } catch (e) {
        console.warn('[admin/offers] pending publication activation failed', e);
      }
      const { radarService } = await import("@/lib/services/radar.service");
      await radarService.matchNewOffer(updated);
    }

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
    await prisma.offer.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
