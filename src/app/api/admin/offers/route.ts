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
import { listOfferImportSourceMeta } from '@/lib/offerPrivateNotes';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';

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

function offerTab(offer: { status?: string | null; expiresAt?: Date | string | null }): 'pending' | 'active' | 'archived' {
  const status = String(offer.status || '').toUpperCase();
  const expired =
    Boolean(offer.expiresAt) && new Date(offer.expiresAt as Date | string).getTime() < Date.now();
  if (status === 'ARCHIVED' || expired) return 'archived';
  if (status === 'ACTIVE') return 'active';
  return 'pending';
}

/** Lista admina: bez pełnego opisu i galerii — tylko miniatura + metadane. */
function slimOfferImages(images: string | null | undefined) {
  const thumb = resolveOfferPrimaryImage({ images });
  return thumb ? JSON.stringify([thumb]) : null;
}

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const segmentRaw = String(url.searchParams.get('segment') || 'all').trim().toLowerCase();
    const segment =
      segmentRaw === 'pending' || segmentRaw === 'active' || segmentRaw === 'archived'
        ? segmentRaw
        : 'all';
    const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const limitRaw = Number(url.searchParams.get('limit') || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 1000) : 0;

    const offers = await prisma.offer.findMany({
      select: {
        id: true,
        title: true,
        city: true,
        district: true,
        price: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        images: true,
        description: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            planType: true,
            isPro: true,
            role: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const offerIds = offers.map((o) => o.id);
    // Tylko cache z DB — bez synchronicznych HTTP do Otodom/OLX (to blokowało otwarcie zakładki).
    const sourceMeta = await listOfferImportSourceMeta(offerIds);

    const counts = { pending: 0, active: 0, archived: 0, total: offers.length };
    const enriched = offers.map((offer) => {
      const tab = offerTab(offer);
      counts[tab] += 1;
      const { verification } = extractVerificationMeta(offer.description);
      const source = sourceMeta.get(offer.id);
      return {
        id: offer.id,
        title: offer.title,
        city: offer.city,
        district: offer.district,
        price: offer.price,
        status: offer.status,
        expiresAt: offer.expiresAt,
        createdAt: offer.createdAt,
        updatedAt: offer.updatedAt,
        advertiserType: offer.user?.planType === 'AGENCY' ? 'agency' : null,
        userId: offer.userId,
        images: slimOfferImages(offer.images),
        user: offer.user,
        verificationStatus: verification.status,
        importExternalUrl: source?.importExternalUrl ?? null,
        sourceIsActive: source?.sourceIsActive ?? null,
        sourceListingExpired: source?.sourceIsActive === false,
        sourceLastCheckAt: source?.sourceLastCheckAt ?? null,
        _tab: tab as 'pending' | 'active' | 'archived',
      };
    });

    let filtered = enriched;
    if (segment !== 'all') {
      filtered = filtered.filter((o) => o._tab === segment);
    }
    if (q) {
      const qId = Number(q);
      filtered = filtered.filter((o) => {
        if (Number.isFinite(qId) && qId > 0 && o.id === qId) return true;
        const owner = String(o.user?.name || o.user?.email || '').toLowerCase();
        const email = String(o.user?.email || '').toLowerCase();
        return (
          String(o.id).includes(q) ||
          String(o.title || '').toLowerCase().includes(q) ||
          String(o.city || '').toLowerCase().includes(q) ||
          String(o.district || '').toLowerCase().includes(q) ||
          owner.includes(q) ||
          email.includes(q) ||
          String(o.userId).includes(q)
        );
      });
    }

    const sliced = limit > 0 ? filtered.slice(0, limit) : filtered;
    const payload = sliced.map(({ _tab, ...rest }) => rest);

    return NextResponse.json({
      success: true,
      offers: payload,
      counts,
      meta: {
        segment,
        q: q || null,
        returned: payload.length,
        matched: filtered.length,
        total: counts.total,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, status, verificationStatus, userId: nextUserIdRaw } = body;
    const offerId = Number(id);
    if (!Number.isFinite(offerId) || offerId <= 0) {
      return NextResponse.json({ success: false, error: 'Nieprawidłowe ID oferty.' }, { status: 400 });
    }

    const existing = await prisma.offer.findUnique({ where: { id: offerId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Oferta nie istnieje.' }, { status: 404 });
    }

    // Samo przeniesienie właściciela (bez zmiany statusu).
    const wantsReassign = nextUserIdRaw !== undefined && nextUserIdRaw !== null && nextUserIdRaw !== '';
    const wantsStatus = status !== undefined && status !== null && String(status).trim() !== '';
    const wantsVerification =
      verificationStatus !== undefined &&
      verificationStatus !== null &&
      String(verificationStatus).trim() !== '';

    if (wantsReassign && !wantsStatus && !wantsVerification) {
      const nextUserId = Number(nextUserIdRaw);
      if (!Number.isFinite(nextUserId) || nextUserId <= 0) {
        return NextResponse.json({ success: false, error: 'Nieprawidłowe ID użytkownika.' }, { status: 400 });
      }
      if (nextUserId === Number(existing.userId)) {
        const current = await prisma.offer.findUnique({
          where: { id: offerId },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                planType: true,
                isPro: true,
                buyerType: true,
                role: true,
              },
            },
          },
        });
        return NextResponse.json({ success: true, offer: current });
      }

      const target = await prisma.user.findUnique({
        where: { id: nextUserId },
        select: {
          id: true,
          name: true,
          email: true,
          planType: true,
          isPro: true,
          buyerType: true,
          role: true,
        },
      });
      if (!target) {
        return NextResponse.json({ success: false, error: 'Użytkownik docelowy nie istnieje.' }, { status: 404 });
      }

      const updated = await prisma.offer.update({
        where: { id: offerId },
        data: { userId: nextUserId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              planType: true,
              isPro: true,
              buyerType: true,
              role: true,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        offer: updated,
        reassigned: true,
        previousUserId: existing.userId,
      });
    }

    const normalizedStatus = normalizeStatus(status ?? existing.status);
    const normalizedVerificationStatus = normalizeVerificationStatus(verificationStatus);

    const nextDescription = normalizedVerificationStatus
      ? setVerificationStatusInDescription(existing.description || '', normalizedVerificationStatus)
      : undefined;

    if (wantsReassign) {
      const nextUserId = Number(nextUserIdRaw);
      if (!Number.isFinite(nextUserId) || nextUserId <= 0) {
        return NextResponse.json({ success: false, error: 'Nieprawidłowe ID użytkownika.' }, { status: 400 });
      }
      const target = await prisma.user.findUnique({ where: { id: nextUserId }, select: { id: true } });
      if (!target) {
        return NextResponse.json({ success: false, error: 'Użytkownik docelowy nie istnieje.' }, { status: 404 });
      }
    }

    if (normalizedStatus === 'ARCHIVED') {
      await adminForceArchiveOffer(offerId);
      if (wantsReassign) {
        await prisma.offer.update({
          where: { id: offerId },
          data: { userId: Number(nextUserIdRaw) },
        });
      }
      const updated = await prisma.offer.findUnique({
        where: { id: offerId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              planType: true,
              isPro: true,
              buyerType: true,
              role: true,
            },
          },
        },
      });
      return NextResponse.json({ success: true, offer: updated });
    }

    if (normalizedStatus === 'ACTIVE') {
      const ownerUserId = wantsReassign ? Number(nextUserIdRaw) : Number(existing.userId);
      const wasArchived = String(existing.status).toUpperCase() === 'ARCHIVED';

      if (wasArchived) {
        const reactivation = await adminReactivateArchivedOffer({
          offerId,
          ownerUserId,
        });
        if (!reactivation.ok) {
          return NextResponse.json(
            { success: false, error: reactivation.message, code: reactivation.code },
            { status: 409 },
          );
        }

        const updated = await prisma.offer.update({
          where: { id: offerId },
          data: {
            status: 'ACTIVE',
            expiresAt: reactivation.endsAt,
            ...(wantsReassign ? { userId: ownerUserId } : {}),
            ...(nextDescription !== undefined ? { description: nextDescription } : {}),
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                planType: true,
                isPro: true,
                buyerType: true,
                role: true,
              },
            },
          },
        });

        return NextResponse.json({ success: true, offer: updated });
      }

      const approval = await completeAdminOfferApproval({
        offerId,
        ownerUserId,
        onFreeFirstCouponUsed: markProfilePromoCardUsed,
      });

      if (!approval.ok) {
        return NextResponse.json(
          { success: false, error: approval.message, code: approval.code },
          { status: 409 },
        );
      }

      const updated = await prisma.offer.update({
        where: { id: offerId },
        data: {
          status: 'ACTIVE',
          expiresAt: approval.endsAt,
          ...(wantsReassign ? { userId: ownerUserId } : {}),
          ...(nextDescription !== undefined ? { description: nextDescription } : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              planType: true,
              isPro: true,
              buyerType: true,
              role: true,
            },
          },
        },
      });

      return NextResponse.json({ success: true, offer: updated });
    }

    const updated = await prisma.offer.update({
      where: { id: offerId },
      data: {
        status: normalizedStatus,
        ...(wantsReassign ? { userId: Number(nextUserIdRaw) } : {}),
        ...(nextDescription !== undefined ? { description: nextDescription } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            planType: true,
            isPro: true,
            buyerType: true,
            role: true,
          },
        },
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
        { status: 409 },
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
