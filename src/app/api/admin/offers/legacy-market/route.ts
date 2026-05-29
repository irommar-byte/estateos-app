import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { activePublicationOfferIds } from '@/lib/offerPublication';
import { canShowOfferOnPublicMarket } from '@/lib/offerMarketVisibility';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { ensureOfferPendingPublicationColumns } from '@/lib/offerPendingPublication';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const nextAuth = await getServerSession(authOptions);
  const email = String(nextAuth?.user?.email || '').trim().toLowerCase();
  if (email) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
    if (user?.role === 'ADMIN') return user;
  }
  const cookieStore = await cookies();
  const token =
    cookieStore.get('estateos_session')?.value || cookieStore.get('luxestate_user')?.value || null;
  if (!token) return null;
  const session = decryptSession(token);
  const sessionEmail = String(session?.email || '').trim().toLowerCase();
  if (!sessionEmail) return null;
  return prisma.user.findUnique({ where: { email: sessionEmail }, select: { id: true, role: true } });
}

/** Oferty ACTIVE na rynku bez oczekującej publikacji w kolejce moderacji (legacy). */
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const offers = await prisma.offer.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
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
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const ids = offers.map((o) => Number(o.id)).filter((id) => Number.isFinite(id));
    const pubIds = ids.length ? await activePublicationOfferIds(ids) : new Set<number>();

    await ensureOfferPendingPublicationColumns();
    const pendingKindRows = ids.length
      ? ((await prisma.$queryRawUnsafe(
          `SELECT id, pendingPublicationKind FROM \`Offer\` WHERE id IN (${ids.join(',')})`,
        )) as Array<{ id: number; pendingPublicationKind: string | null }>)
      : [];
    const stagedSet = new Set(
      pendingKindRows
        .filter((r) => r.pendingPublicationKind != null && String(r.pendingPublicationKind).trim() !== '')
        .map((r) => Number(r.id)),
    );

    const legacy = offers
      .filter((o) => canShowOfferOnPublicMarket(o, pubIds) && !stagedSet.has(Number(o.id)))
      .map((o) => ({
        id: o.id,
        title: o.title,
        city: o.city,
        district: o.district,
        price: o.price,
        expiresAt: o.expiresAt,
        updatedAt: o.updatedAt,
        imageUrl: resolveOfferPrimaryImage(o),
        owner: o.user,
        reason: 'ACTIVE_ON_MARKET_WITHOUT_PENDING_QUEUE',
      }));

    return NextResponse.json({ success: true, count: legacy.length, offers: legacy });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/** Batch: wstrzymaj legacy oferty z rynku (status PENDING + clear pending pub). */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const offerIds = Array.isArray(body?.offerIds)
      ? body.offerIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id) && id > 0)
      : [];

    if (!offerIds.length) {
      return NextResponse.json({ success: false, error: 'Brak offerIds' }, { status: 400 });
    }

    const result = await prisma.offer.updateMany({
      where: { id: { in: offerIds }, status: 'ACTIVE' },
      data: { status: 'PENDING', updatedAt: new Date() },
    });

    if (offerIds.length) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM OfferPublication WHERE offerId IN (${offerIds.join(',')}) AND endsAt > NOW(3)`,
      ).catch(() => null);
    }

    return NextResponse.json({ success: true, updated: result.count });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
