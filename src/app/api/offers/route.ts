import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveEliteBadges } from '@/lib/eliteStatus';
import { createOffer } from '@/lib/services/offer.service';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { extractVerificationMeta } from '@/lib/offerVerification';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';

export const dynamic = 'force-dynamic';

// =======================
// GET
// =======================
export async function GET() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS OfferViewLog (
        id BIGINT NOT NULL AUTO_INCREMENT,
        offerId INT NOT NULL,
        visitorKey VARCHAR(128) NOT NULL,
        source VARCHAR(16) NOT NULL DEFAULT 'web',
        ip VARCHAR(64) NULL,
        userAgent VARCHAR(255) NULL,
        hits INT NOT NULL DEFAULT 1,
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        lastSeenAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY OfferViewLog_offerId_visitorKey_key (offerId, visitorKey),
        KEY OfferViewLog_offerId_lastSeenAt_idx (offerId, lastSeenAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const offers = await prisma.offer.findMany({
      where: { status: { in: ["ACTIVE"] } },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { role: true, planType: true, isPro: true } },
      },
    });

    const toPublicOffer = (offer: any, viewsCount: number) => {
      const { user, ...rest } = offer;
      const badges = resolveEliteBadges({ user });
      const { cleanDescription, verification } = extractVerificationMeta(rest.description);
      return {
        ...rest,
        imageUrl: resolveOfferPrimaryImage(rest),
        description: cleanDescription,
        apartmentNumber: verification.apartmentNumber || rest.buildingNumber || "",
        landRegistryNumber: verification.landRegistryNumber || "",
        verificationStatus: verification.status,
        badges,
        views: viewsCount,
        viewsCount,
      };
    };

    const offerIds = offers.map((o) => Number(o.id)).filter((id) => Number.isFinite(id));
    if (!offerIds.length) {
      return NextResponse.json(offers.map((o) => toPublicOffer(o, 0)));
    }

    const viewsRows = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT offerId, COUNT(*) AS total
        FROM OfferViewLog
        WHERE offerId IN (${offerIds.join(',')})
        GROUP BY offerId
      `
    );

    const viewsMap = new Map<number, number>(
      viewsRows.map((row: any) => [Number(row.offerId), Number(row.total || 0)])
    );

    return NextResponse.json(
      offers.map((offer: any) => {
        const viewsCount = viewsMap.get(Number(offer.id)) || 0;
        return toPublicOffer(offer, viewsCount);
      })
    );

  } catch (error) {
    console.error('OFFERS ERROR:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

// =======================
// POST
// =======================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    let resolvedUserId: number | null = Number(body?.userId) || null;

    if (!resolvedUserId) {
      const cookieStore = await cookies();
      const nextAuthSession = await getServerSession(authOptions);
      const sessionCookie = cookieStore.get('estateos_session') || cookieStore.get('luxestate_user');

      let email = nextAuthSession?.user?.email || null;
      let sessionUserId: number | null = null;

      if (!email && sessionCookie?.value) {
        try {
          const sessionData = decryptSession(sessionCookie.value);
          email = sessionData?.email || null;
          sessionUserId = Number(sessionData?.id) || null;
        } catch {
          email = null;
          sessionUserId = null;
        }
      }

      if (sessionUserId) {
        resolvedUserId = sessionUserId;
      } else if (email) {
        const user = await prisma.user.findUnique({
          where: { email: String(email) },
          select: { id: true }
        });
        resolvedUserId = user?.id ?? null;
      }
    }

    if (!resolvedUserId) {
      return NextResponse.json({ error: 'Brak ID użytkownika' }, { status: 401 });
    }

    const offer = await createOffer({ ...body, userId: resolvedUserId });

    return NextResponse.json({ success: true, offer });

  } catch (e: any) {
    console.error('POST ERROR:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
